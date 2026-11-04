package com.cubelogistics.placement

import android.content.Context

class Store(context: Context) {
    private val p = context.getSharedPreferences("cube_store", Context.MODE_PRIVATE)

    var fuelRate: Double
        get() = p.getFloat("fuel_rate", 100f).toDouble()
        set(value) {
            p.edit().putFloat("fuel_rate", value.toFloat()).apply()
        }

    fun vehicles() = mutableListOf(
        Vehicle("KA51AM6819", 3.0),
        Vehicle("TN28BX7711", 4.0)
    )

    fun vendors() = mutableListOf(Vendor("GLOBAL TRP"))

    fun locations() = mutableListOf(
        Location("NAVI MUMBAI"),
        Location("BHIWANDI"),
        Location("ERODE")
    )

    fun trips(): MutableList<Trip> = mutableListOf()

    fun saveVehicles(items: List<Vehicle>) {}
    fun saveVendors(items: List<Vendor>) {}
    fun saveLocations(items: List<Location>) {}
    fun saveTrips(items: List<Trip>) {}
}
