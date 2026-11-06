package com.cubelogistics.placement

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

data class RoleDefinition(
    val id: String,
    val name: String,
    val canCreateTrips: Boolean = false,
    val canManageMasters: Boolean = false,
    val canDeleteTrips: Boolean = false,
    val canViewReports: Boolean = true,
    val canManageUsers: Boolean = false
) {
    val isAdmin: Boolean get() = canManageUsers && canManageMasters
}

data class UserProfile(
    val uid: String,
    val username: String,
    val loginEmail: String,
    val roleId: String,
    val role: RoleDefinition
)

class UserRoleRepository(private val context: Context) {
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()

    private fun defaultAdminRole() = RoleDefinition(
        id = "admin",
        name = "Admin",
        canCreateTrips = true,
        canManageMasters = true,
        canDeleteTrips = true,
        canViewReports = true,
        canManageUsers = true
    )

    private fun defaultUserRole() = RoleDefinition(
        id = "user",
        name = "User",
        canCreateTrips = true,
        canManageMasters = false,
        canDeleteTrips = false,
        canViewReports = true,
        canManageUsers = false
    )

    private fun defaultManagerRole() = RoleDefinition(
        id = "manager",
        name = "Manager",
        canCreateTrips = true,
        canManageMasters = true,
        canDeleteTrips = false,
        canViewReports = true,
        canManageUsers = false
    )

    fun ensureDefaultRoles(onComplete: (Result<Unit>) -> Unit = {}) {
        val defaults = listOf(defaultAdminRole(), defaultUserRole(), defaultManagerRole())
        val batch = db.batch()
        defaults.forEach { role ->
            val ref = db.collection("roles").document(role.id)
            batch.set(ref, role.toMap(), com.google.firebase.firestore.SetOptions.merge())
        }
        batch.commit()
            .addOnSuccessListener { onComplete(Result.success(Unit)) }
            .addOnFailureListener { onComplete(Result.failure(it)) }
    }

    fun listRoles(onComplete: (Result<List<RoleDefinition>>) -> Unit) {
        db.collection("roles").orderBy("name").get()
            .addOnSuccessListener { snap ->
                val roles = snap.documents.mapNotNull { it.toRoleOrNull() }
                onComplete(Result.success(roles))
            }
            .addOnFailureListener { onComplete(Result.failure(it)) }
    }

    fun createRole(role: RoleDefinition, onComplete: (Result<Unit>) -> Unit) {
        db.collection("roles").document(role.id).get()
            .addOnSuccessListener { existing ->
                if (existing.exists()) {
                    onComplete(Result.failure(IllegalArgumentException("Role already exists")))
                } else {
                    db.collection("roles").document(role.id).set(role.toMap())
                        .addOnSuccessListener { onComplete(Result.success(Unit)) }
                        .addOnFailureListener { onComplete(Result.failure(it)) }
                }
            }
            .addOnFailureListener { onComplete(Result.failure(it)) }
    }

    fun updateRoleDefinition(role: RoleDefinition, onComplete: (Result<Unit>) -> Unit) {
        db.collection("roles").document(role.id).set(role.toMap())
            .addOnSuccessListener { onComplete(Result.success(Unit)) }
            .addOnFailureListener { onComplete(Result.failure(it)) }
    }

    fun listUsers(onComplete: (Result<List<UserProfile>>) -> Unit) {
        db.collection("users").orderBy("usernameLower").get()
            .addOnSuccessListener { snap ->
                listRoles { roleResult ->
                    val roles = roleResult.getOrDefault(emptyList()).associateBy { it.id }
                    val users = snap.documents.mapNotNull { doc ->
                        val uid = doc.getString("uid") ?: doc.id
                        val username = doc.getString("username") ?: doc.getString("email") ?: return@mapNotNull null
                        val loginEmail = doc.getString("loginEmail") ?: doc.getString("email") ?: ""
                        val roleId = doc.getString("roleId") ?: doc.getString("role") ?: "user"
                        val role = roles[roleId] ?: if (roleId == "admin") defaultAdminRole() else defaultUserRole()
                        UserProfile(uid, username, loginEmail, roleId, role)
                    }
                    onComplete(Result.success(users))
                }
            }
            .addOnFailureListener { onComplete(Result.failure(it)) }
    }

    fun updateUserRole(uid: String, roleId: String, onComplete: (Result<Unit>) -> Unit) {
        db.collection("users").document(uid)
            .update(
                mapOf(
                    "roleId" to roleId,
                    "updatedAt" to System.currentTimeMillis()
                )
            )
            .addOnSuccessListener { onComplete(Result.success(Unit)) }
            .addOnFailureListener { onComplete(Result.failure(it)) }
    }

    fun createUser(
        username: String,
        password: String,
        roleId: String,
        onComplete: (Result<Unit>) -> Unit
    ) {
        val normalized = normalizeUsername(username)
        if (normalized.length < 3) {
            onComplete(Result.failure(IllegalArgumentException("Username must have at least 3 characters")))
            return
        }
        if (password.length < 6) {
            onComplete(Result.failure(IllegalArgumentException("Password must have at least 6 characters")))
            return
        }

        db.collection("users").whereEqualTo("usernameLower", normalized).limit(1).get()
            .addOnSuccessListener { duplicate ->
                if (!duplicate.isEmpty) {
                    onComplete(Result.failure(IllegalArgumentException("Username already exists")))
                    return@addOnSuccessListener
                }

                val internalEmail = internalEmailFor(normalized)
                val primaryApp = FirebaseApp.getInstance()
                val secondaryName = "userCreator-" + System.currentTimeMillis()
                val secondaryApp = FirebaseApp.initializeApp(context, primaryApp.options, secondaryName)
                if (secondaryApp == null) {
                    onComplete(Result.failure(IllegalStateException("Unable to initialize user creator")))
                    return@addOnSuccessListener
                }
                val secondaryAuth = FirebaseAuth.getInstance(secondaryApp)
                secondaryAuth.createUserWithEmailAndPassword(internalEmail, password)
                    .addOnSuccessListener { authResult ->
                        val uid = authResult.user?.uid
                        if (uid == null) {
                            secondaryApp.delete()
                            onComplete(Result.failure(IllegalStateException("Unable to create user")))
                            return@addOnSuccessListener
                        }
                        val doc = mapOf(
                            "uid" to uid,
                            "username" to username.trim(),
                            "usernameLower" to normalized,
                            "loginEmail" to internalEmail,
                            "roleId" to roleId,
                            "active" to true,
                            "createdAt" to System.currentTimeMillis(),
                            "updatedAt" to System.currentTimeMillis()
                        )
                        db.collection("users").document(uid).set(doc)
                            .addOnSuccessListener {
                                secondaryAuth.signOut()
                                secondaryApp.delete()
                                onComplete(Result.success(Unit))
                            }
                            .addOnFailureListener {
                                secondaryAuth.signOut()
                                secondaryApp.delete()
                                onComplete(Result.failure(it))
                            }
                    }
                    .addOnFailureListener {
                        secondaryApp.delete()
                        onComplete(Result.failure(it))
                    }
            }
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
                    val roleId = doc.getString("roleId") ?: doc.getString("role") ?: "user"
                    loadRole(roleId) { roleResult ->
                        val role = roleResult.getOrElse {
                            if (roleId == "admin") defaultAdminRole() else defaultUserRole()
                        }
                        onComplete(
                            Result.success(
                                UserProfile(
                                    uid = user.uid,
                                    username = doc.getString("username") ?: user.email.orEmpty(),
                                    loginEmail = doc.getString("loginEmail") ?: user.email.orEmpty(),
                                    roleId = roleId,
                                    role = role
                                )
                            )
                        )
                    }
                } else {
                    bootstrapMissingProfile(user.uid, user.email.orEmpty(), onComplete)
                }
            }
            .addOnFailureListener { onComplete(Result.failure(it)) }
    }

    fun resolveLoginIdentity(input: String): String {
        val trimmed = input.trim()
        return if (trimmed.contains("@")) trimmed else internalEmailFor(normalizeUsername(trimmed))
    }

    private fun loadRole(roleId: String, onComplete: (Result<RoleDefinition>) -> Unit) {
        db.collection("roles").document(roleId).get()
            .addOnSuccessListener { doc ->
                val role = doc.toRoleOrNull()
                if (role != null) onComplete(Result.success(role))
                else onComplete(Result.failure(IllegalStateException("Role not found")))
            }
            .addOnFailureListener { onComplete(Result.failure(it)) }
    }

    private fun bootstrapMissingProfile(
        uid: String,
        email: String,
        onComplete: (Result<UserProfile>) -> Unit
    ) {
        ensureDefaultRoles {
            db.collection("users").limit(1).get()
                .addOnSuccessListener { existingUsers ->
                    if (!existingUsers.isEmpty) {
                        auth.signOut()
                        onComplete(Result.failure(IllegalAccessException("This account is not authorized. Please contact Admin.")))
                        return@addOnSuccessListener
                    }

                    val role = defaultAdminRole()
                    val username = email.substringBefore("@").ifBlank { "admin" }
                    val data = mapOf(
                        "uid" to uid,
                        "username" to username,
                        "usernameLower" to normalizeUsername(username),
                        "loginEmail" to email,
                        "roleId" to role.id,
                        "active" to true,
                        "createdAt" to System.currentTimeMillis(),
                        "updatedAt" to System.currentTimeMillis()
                    )
                    db.collection("users").document(uid).set(data)
                        .addOnSuccessListener {
                            onComplete(Result.success(UserProfile(uid, username, email, role.id, role)))
                        }
                        .addOnFailureListener { onComplete(Result.failure(it)) }
                }
                .addOnFailureListener { onComplete(Result.failure(it)) }
        }
    }

    private fun normalizeUsername(value: String): String =
        value.trim().lowercase().replace(Regex("[^a-z0-9._-]"), "")

    private fun internalEmailFor(username: String): String =
        username + "@cube.internal"
}

private fun RoleDefinition.toMap(): Map<String, Any> = mapOf(
    "id" to id,
    "name" to name,
    "canCreateTrips" to canCreateTrips,
    "canManageMasters" to canManageMasters,
    "canDeleteTrips" to canDeleteTrips,
    "canViewReports" to canViewReports,
    "canManageUsers" to canManageUsers,
    "updatedAt" to System.currentTimeMillis()
)

private fun com.google.firebase.firestore.DocumentSnapshot.toRoleOrNull(): RoleDefinition? {
    val idValue = getString("id") ?: id
    val nameValue = getString("name") ?: return null
    return RoleDefinition(
        id = idValue,
        name = nameValue,
        canCreateTrips = getBoolean("canCreateTrips") ?: false,
        canManageMasters = getBoolean("canManageMasters") ?: false,
        canDeleteTrips = getBoolean("canDeleteTrips") ?: false,
        canViewReports = getBoolean("canViewReports") ?: true,
        canManageUsers = getBoolean("canManageUsers") ?: false
    )
}
