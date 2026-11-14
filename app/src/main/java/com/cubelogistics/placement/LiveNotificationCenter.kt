package com.cubelogistics.placement

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentChange
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration

object LiveNotificationCenter {
    private var registration: ListenerRegistration? = null
    private var startedAt: Long = 0L

    fun start(context: Context, currentUid: String) {
        stop()
        startedAt = System.currentTimeMillis()
        createChannel(context)

        registration = FirebaseFirestore.getInstance()
            .collection("notifications")
            .whereGreaterThan("createdAt", startedAt)
            .addSnapshotListener { snapshot, _ ->
                snapshot?.documentChanges
                    ?.filter { it.type == DocumentChange.Type.ADDED }
                    ?.forEach { change ->
                        val data = change.document.data
                        val target = data["target"]?.toString().orEmpty()
                        val creatorUid = data["createdByUid"]?.toString().orEmpty()
                        if (target.isNotBlank() && target != "all") return@forEach
                        if (creatorUid == currentUid) return@forEach

                        showLocal(
                            context = context,
                            title = data["title"]?.toString() ?: "CUBE Logistics",
                            body = data["body"]?.toString() ?: "New update",
                            tripId = data["tripId"]?.toString().orEmpty()
                        )
                    }
            }
    }

    fun stop() {
        registration?.remove()
        registration = null
    }

    fun create(
        title: String,
        body: String,
        tripId: String = "",
        type: String = "general",
        createdBy: String = "",
        createdByUid: String = ""
    ) {
        val ref = FirebaseFirestore.getInstance().collection("notifications").document()
        ref.set(
            mapOf(
                "id" to ref.id,
                "title" to title,
                "body" to body,
                "tripId" to tripId,
                "type" to type,
                "target" to "all",
                "createdAt" to System.currentTimeMillis(),
                "createdBy" to createdBy,
                "createdByUid" to createdByUid.ifBlank { FirebaseAuth.getInstance().currentUser?.uid.orEmpty() }
            )
        )
    }

    private fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (manager.getNotificationChannel("cube_live") == null) {
                manager.createNotificationChannel(
                    NotificationChannel(
                        "cube_live",
                        "CUBE Live Updates",
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        description = "Live trip and placement updates while CUBE Logistics is running"
                    }
                )
            }
        }
    }

    private fun showLocal(context: Context, title: String, body: String, tripId: String) {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("tripId", tripId)
        }
        val pending = PendingIntent.getActivity(
            context,
            tripId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, "cube_live")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notification)
    }
}
