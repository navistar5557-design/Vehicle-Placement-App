package com.cubelogistics.placement

import android.content.Context
import android.util.Base64
import com.google.firebase.FirebaseApp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions

class FirestoreSync(private val context: Context, private val store: Store) {
    private val app: FirebaseApp? by lazy {
        FirebaseApp.getApps(context).firstOrNull() ?: FirebaseApp.initializeApp(context)
    }

    private val db: FirebaseFirestore?
        get() = app?.let { FirebaseFirestore.getInstance(it) }

    fun isConfigured(): Boolean = db != null

    private fun attachDeletionSync() {
        val firestore = db ?: return
        store.onVehicleRemoved = { oldNumber ->
            firestore.collection("vehicles").document(idOf(oldNumber)).delete()
        }
        store.onVendorRemoved = { oldName ->
            firestore.collection("vendors").document(idOf(oldName)).delete()
        }
        store.onLocationRemoved = { oldName ->
            firestore.collection("locations").document(idOf(oldName)).delete()
        }
        store.onTripRemoved = { tripId ->
            firestore.collection("trips").document(tripId).delete()
        }
    }

    fun startAutomaticSync(onComplete: (Result<Unit>) -> Unit = {}) {
        val firestore = db
        if (firestore == null) {
            onComplete(Result.failure(IllegalStateException("Firebase is not configured yet")))
            return
        }

        val collections = listOf("vehicles", "vendors", "locations", "trips")
        val results = mutableMapOf<String, Boolean>()

        fun finishCheck() {
            if (results.size != collections.size) return
            val cloudHasData = results.values.any { it }
            if (cloudHasData) {
                downloadCloudSnapshot { result ->
                    if (result.isSuccess) {
                        store.onDataChanged = { uploadLocalSnapshot() }
                        attachDeletionSync()
                    }
                    onComplete(result)
                }
            } else {
                uploadLocalSnapshot { result ->
                    if (result.isSuccess) {
                        store.onDataChanged = { uploadLocalSnapshot() }
                        attachDeletionSync()
                    }
                    onComplete(result)
                }
            }
        }

        collections.forEach { name ->
            firestore.collection(name).limit(1).get()
                .addOnSuccessListener {
                    results[name] = !it.isEmpty
                    finishCheck()
                }
                .addOnFailureListener {
                    onComplete(Result.failure(it))
                }
        }
    }

    fun uploadLocalSnapshot(onComplete: (Result<Unit>) -> Unit = {}) {
        val firestore = db
        if (firestore == null) {
            onComplete(Result.failure(IllegalStateException("Firebase is not configured yet")))
            return
        }

        val writes = mutableListOf<Pair<com.google.firebase.firestore.DocumentReference, Map<String, Any>>>()

        store.vehicles().forEach { vehicle ->
            writes += firestore.collection("vehicles").document(idOf(vehicle.number)) to mapOf(
                "number" to vehicle.number,
                "mileage" to vehicle.mileage,
                "active" to vehicle.active,
                "updatedAt" to System.currentTimeMillis()
            )
        }

        store.vendors().forEach { vendor ->
            writes += firestore.collection("vendors").document(idOf(vendor.name)) to mapOf(
                "name" to vendor.name,
                "active" to vendor.active,
                "updatedAt" to System.currentTimeMillis()
            )
        }

        store.locations().forEach { location ->
            writes += firestore.collection("locations").document(idOf(location.name)) to mapOf(
                "name" to location.name,
                "active" to location.active,
                "updatedAt" to System.currentTimeMillis()
            )
        }

        store.trips().forEach { trip ->
            writes += firestore.collection("trips").document(trip.id) to trip.toFirestoreMap()
        }

        writes += firestore.collection("settings").document("fuelRate") to mapOf(
            "value" to store.fuelRate,
            "updatedAt" to System.currentTimeMillis()
        )

        commitChunks(firestore, writes.chunked(400), 0, onComplete)
    }

    private fun commitChunks(
        firestore: FirebaseFirestore,
        chunks: List<List<Pair<com.google.firebase.firestore.DocumentReference, Map<String, Any>>>>,
        index: Int,
        onComplete: (Result<Unit>) -> Unit
    ) {
        if (index >= chunks.size) {
            onComplete(Result.success(Unit))
            return
        }

        val batch = firestore.batch()
        chunks[index].forEach { (ref, data) ->
            batch.set(ref, data, SetOptions.merge())
        }

        batch.commit()
            .addOnSuccessListener { commitChunks(firestore, chunks, index + 1, onComplete) }
            .addOnFailureListener { onComplete(Result.failure(it)) }
    }

    fun downloadCloudSnapshot(onComplete: (Result<Unit>) -> Unit = {}) {
        val firestore = db
        if (firestore == null) {
            onComplete(Result.failure(IllegalStateException("Firebase is not configured yet")))
            return
        }

        firestore.collection("vehicles").get()
            .addOnSuccessListener { vehicleSnap ->
                val vehicles = vehicleSnap.documents.mapNotNull { doc ->
                    val number = doc.getString("number") ?: return@mapNotNull null
                    val mileage = doc.getDouble("mileage") ?: return@mapNotNull null
                    Vehicle(number, mileage, doc.getBoolean("active") ?: true)
                }
                store.withoutCloudCallback { store.saveVehicles(vehicles) }

                firestore.collection("vendors").get()
                    .addOnSuccessListener { vendorSnap ->
                        val vendors = vendorSnap.documents.mapNotNull { doc ->
                            doc.getString("name")?.let { Vendor(it, doc.getBoolean("active") ?: true) }
                        }
                        store.withoutCloudCallback { store.saveVendors(vendors) }

                        firestore.collection("locations").get()
                            .addOnSuccessListener { locationSnap ->
                                val locations = locationSnap.documents.mapNotNull { doc ->
                                    doc.getString("name")?.let { Location(it, doc.getBoolean("active") ?: true) }
                                }
                                store.withoutCloudCallback { store.saveLocations(locations) }

                                firestore.collection("trips").get()
                                    .addOnSuccessListener { tripSnap ->
                                        val trips = tripSnap.documents.mapNotNull { it.toTripOrNull() }
                                        store.withoutCloudCallback { store.saveTrips(trips) }

                                        firestore.collection("settings").document("fuelRate").get()
                                            .addOnSuccessListener { fuelDoc ->
                                                fuelDoc.getDouble("value")?.let { value ->
                                                    store.withoutCloudCallback { store.fuelRate = value }
                                                }
                                                onComplete(Result.success(Unit))
                                            }
                                            .addOnFailureListener { onComplete(Result.failure(it)) }
                                    }
                                    .addOnFailureListener { onComplete(Result.failure(it)) }
                            }
                            .addOnFailureListener { onComplete(Result.failure(it)) }
                    }
                    .addOnFailureListener { onComplete(Result.failure(it)) }
            }
            .addOnFailureListener { onComplete(Result.failure(it)) }
    }

    private fun idOf(value: String): String =
        Base64.encodeToString(value.toByteArray(), Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
}

private fun Trip.toFirestoreMap(): Map<String, Any> = mapOf(
    "id" to id,
    "createdAt" to createdAt,
    "vendor" to vendor,
    "vehicle" to vehicle,
    "currentLocation" to currentLocation,
    "from" to from,
    "to" to to,
    "freight" to freight,
    "netFreight" to netFreight,
    "advance" to advance,
    "weightTon" to weightTon,
    "currentToOriginKm" to currentToOriginKm,
    "totalKm" to totalKm,
    "transitHours" to transitHours,
    "mileage" to mileage,
    "fuelRate" to fuelRate,
    "fixedExpenses" to fixedExpenses,
    "fastag" to fastag,
    "rtoTarpaulin" to rtoTarpaulin,
    "loadingUnloading" to loadingUnloading,
    "loadingExpensePerTon" to loadingExpensePerTon,
    "unloadingExpensePerTon" to unloadingExpensePerTon,
    "createdBy" to createdBy,
    "createdByEmail" to createdByEmail,
    "expenseRules" to expenseRules.map { mapOf("name" to it.name, "percent" to it.percent) },
    "updatedAt" to System.currentTimeMillis()
)

private fun com.google.firebase.firestore.DocumentSnapshot.toTripOrNull(): Trip? {
    val rules = (get("expenseRules") as? List<*>)
        ?.mapNotNull { row ->
            val map = row as? Map<*, *> ?: return@mapNotNull null
            val name = map["name"] as? String ?: return@mapNotNull null
            val percent = (map["percent"] as? Number)?.toDouble() ?: return@mapNotNull null
            ExpenseRule(name, percent)
        }
        ?: emptyList()

    return try {
        Trip(
            id = getString("id") ?: id,
            createdAt = getLong("createdAt") ?: 0L,
            vendor = getString("vendor") ?: "",
            vehicle = getString("vehicle") ?: "",
            currentLocation = getString("currentLocation") ?: "",
            from = getString("from") ?: "",
            to = getString("to") ?: "",
            freight = getDouble("freight") ?: 0.0,
            netFreight = getDouble("netFreight") ?: getDouble("freight") ?: 0.0,
            advance = getDouble("advance") ?: 0.0,
            weightTon = getDouble("weightTon") ?: 0.0,
            currentToOriginKm = getDouble("currentToOriginKm") ?: 0.0,
            totalKm = getDouble("totalKm") ?: 0.0,
            transitHours = getDouble("transitHours") ?: 0.0,
            mileage = getDouble("mileage") ?: 0.0,
            fuelRate = getDouble("fuelRate") ?: 0.0,
            fixedExpenses = getDouble("fixedExpenses") ?: 0.0,
            fastag = getDouble("fastag") ?: 0.0,
            rtoTarpaulin = getDouble("rtoTarpaulin") ?: 0.0,
            loadingUnloading = getDouble("loadingUnloading") ?: 0.0,
            expenseRules = rules,
            loadingExpensePerTon = getDouble("loadingExpensePerTon") ?: 0.0,
            unloadingExpensePerTon = getDouble("unloadingExpensePerTon") ?: 0.0,
            createdBy = getString("createdBy") ?: "",
            createdByEmail = getString("createdByEmail") ?: ""
        )
    } catch (_: Exception) {
        null
    }
}
