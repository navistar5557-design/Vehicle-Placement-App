package com.cubelogistics.placement

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

enum class UserRole {
    ADMIN, OPERATOR, VIEWER;

    companion object {
        fun from(value: String?): UserRole = when (value?.lowercase()) {
            "admin" -> ADMIN
            "operator" -> OPERATOR
            else -> VIEWER
        }
    }

    val label: String
        get() = when (this) {
            ADMIN -> "Admin"
            OPERATOR -> "Operator"
            VIEWER -> "Viewer"
        }

    val canCreateTrips: Boolean get() = this == ADMIN || this == OPERATOR
    val canManageMasters: Boolean get() = this == ADMIN
    val canDeleteTrips: Boolean get() = this == ADMIN
    val canViewReports: Boolean get() = true
}

data class UserProfile(
    val uid: String,
    val email: String,
    val role: UserRole
)

class UserRoleRepository {
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()

    fun listUsers(onComplete: (Result<List<UserProfile>>) -> Unit) {
        db.collection("users").orderBy("email").get()
            .addOnSuccessListener { snap ->
                val users = snap.documents.mapNotNull { doc ->
                    val uid = doc.getString("uid") ?: doc.id
                    val email = doc.getString("email") ?: return@mapNotNull null
                    UserProfile(uid, email, UserRole.from(doc.getString("role")))
                }
                onComplete(Result.success(users))
            }
            .addOnFailureListener { onComplete(Result.failure(it)) }
    }

    fun updateRole(uid: String, role: UserRole, onComplete: (Result<Unit>) -> Unit) {
        db.collection("users").document(uid)
            .update(
                mapOf(
                    "role" to role.label.lowercase(),
                    "updatedAt" to System.currentTimeMillis()
                )
            )
            .addOnSuccessListener { onComplete(Result.success(Unit)) }
            .addOnFailureListener { onComplete(Result.failure(it)) }
    }

    fun loadCurrentUser(onComplete: (Result<UserProfile>) -> Unit) {
        val user = auth.currentUser
        if (user == null) {
            onComplete(Result.failure(IllegalStateException("No authenticated user")))
            return
        }

        val ref = db.collection("users").document(user.uid)
        ref.get()
            .addOnSuccessListener { doc ->
                if (doc.exists()) {
                    onComplete(
                        Result.success(
                            UserProfile(
                                uid = user.uid,
                                email = user.email.orEmpty(),
                                role = UserRole.from(doc.getString("role"))
                            )
                        )
                    )
                } else {
                    bootstrapMissingProfile(user.uid, user.email.orEmpty(), onComplete)
                }
            }
            .addOnFailureListener { onComplete(Result.failure(it)) }
    }

    private fun bootstrapMissingProfile(
        uid: String,
        email: String,
        onComplete: (Result<UserProfile>) -> Unit
    ) {
        db.collection("users").limit(1).get()
            .addOnSuccessListener { existingUsers ->
                val role = if (existingUsers.isEmpty) UserRole.ADMIN else UserRole.VIEWER
                val data = mapOf(
                    "uid" to uid,
                    "email" to email,
                    "role" to role.label.lowercase(),
                    "active" to true,
                    "createdAt" to System.currentTimeMillis(),
                    "updatedAt" to System.currentTimeMillis()
                )
                db.collection("users").document(uid).set(data)
                    .addOnSuccessListener {
                        onComplete(Result.success(UserProfile(uid, email, role)))
                    }
                    .addOnFailureListener { onComplete(Result.failure(it)) }
            }
            .addOnFailureListener { onComplete(Result.failure(it)) }
    }
}
