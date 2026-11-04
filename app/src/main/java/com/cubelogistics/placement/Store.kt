package com.cubelogistics.placement
import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
class Store(context:Context){
 private val p=context.getSharedPreferences("cube_store",Context.MODE_PRIVATE)
 var fuelRate:Double get()=p.getFloat("fuel_rate",100f).toDouble() set(v){p.edit().putFloat("fuel_rate",v.toFloat()).apply()}
 fun vehicles()=mutableListOf(Vehicle("KA51AM6819",3.0),Vehicle("TN28BX7711",4.0))
 fun vendors()=mutableListOf(Vendor("GLOBAL TRP"))
 fun locations()=mutableListOf(Location("NAVI MUMBAI"),Location("BHIWANDI"),Location("ERODE"))
 fun trips():MutableList<Trip> = mutableListOf()
 fun saveVehicles(x:List<Vehicle>){}
 fun saveVendors(x:List<Vendor>){}
 fun saveLocations(x:List<Location>){}
 fun saveTrips(x:List<Trip>){}
}