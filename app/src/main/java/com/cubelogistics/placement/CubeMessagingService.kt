package com.cubelogistics.placement

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

object NotificationRegistrar {
    fun registerCurrentDevice(username: String = "") {
        val user = FirebaseAuth.getInstance().currentUser ?: return
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            val id = user.uid + "_android_" + token.hashCode().toUInt().toString(16)
            FirebaseFirestore.getInstance()
                .collection("deviceTokens")
                .document(id)
                .set(
                    mapOf(
                        "uid" to user.uid,
                        "username" to username,
                        "platform" to "android",
                        "token" to token,
                        "active" to true,
                        "updatedAt" to System.currentTimeMillis()
                    )
                )
        }
    }
}

class CubeMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val user = FirebaseAuth.getInstance().currentUser ?: return
        val id = user.uid + "_android_" + token.hashCode().toUInt().toString(16)
        FirebaseFirestore.getInstance()
            .collection("deviceTokens")
            .document(id)
            .set(
                mapOf(
                    "uid" to user.uid,
                    "platform" to "android",
                    "token" to token,
                    "active" to true,
                    "updatedAt" to System.currentTimeMillis()
                )
            )
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val title = message.notification?.title
            ?: message.data["title"]
            ?: "CUBE Logistics"
        val body = message.notification?.body
            ?: message.data["body"]
            ?: "You have a new update."

        createChannel()

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("tripId", message.data["tripId"])
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, "cube_operations")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notification)
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (manager.getNotificationChannel("cube_operations") == null) {
                val channel = NotificationChannel(
                    "cube_operations",
                    "CUBE Operations",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Trip, placement and operations notifications"
                }
                manager.createNotificationChannel(channel)
            }
        }
    }
}
