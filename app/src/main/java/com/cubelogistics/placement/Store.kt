package com.cubelogistics.placement

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

class Store(context:Context){
 private val p=context.getSharedPreferences("cube_store",Context.MODE_PRIVATE)
 var fuelRate: Double
  get() = p.getFloat("fuel_rate", 100f).toDouble()
  set(value) {
   p.edit().putFloat("fuel_rate", value.toFloat()).apply()
  }

 fun vehicles():MutableList<Vehicle>{
  val a=JSONArray(p.getString("vehicles","[]"))
  if(a.length()==0)return mutableListOf(Vehicle("KA51AM6819",3.0),Vehicle("TN28BX7711",4.0))
  return MutableList(a.length()){i->a.getJSONObject(i).let{Vehicle(it.getString("n"),it.getDouble("m"),it.optBoolean("a",true))}}
 }
 fun saveVehicles(x:List<Vehicle>){val a=JSONArray();x.forEach{a.put(JSONObject().put("n",it.number).put("m",it.mileage).put("a",it.active))};p.edit().putString("vehicles",a.toString()).apply()}
 fun vendors():MutableList<Vendor>{val a=JSONArray(p.getString("vendors","[]"));if(a.length()==0)return mutableListOf(Vendor("GLOBAL TRP"));return MutableList(a.length()){Vendor(a.getJSONObject(it).getString("n"),a.getJSONObject(it).optBoolean("a",true))}}
 fun saveVendors(x:List<Vendor>){val a=JSONArray();x.forEach{a.put(JSONObject().put("n",it.name).put("a",it.active))};p.edit().putString("vendors",a.toString()).apply()}
 fun locations():MutableList<Location>{val a=JSONArray(p.getString("locations","[]"));if(a.length()==0)return mutableListOf(Location("NAVI MUMBAI"),Location("BHIWANDI"),Location("ERODE"));return MutableList(a.length()){Location(a.getJSONObject(it).getString("n"),a.getJSONObject(it).optBoolean("a",true))}}
 fun saveLocations(x:List<Location>){val a=JSONArray();x.forEach{a.put(JSONObject().put("n",it.name).put("a",it.active))};p.edit().putString("locations",a.toString()).apply()}
 fun trips():MutableList<Trip>{val a=JSONArray(p.getString("trips","[]"));return MutableList(a.length()){i->decodeTrip(a.getJSONObject(i))}}
 fun saveTrips(x:List<Trip>){val a=JSONArray();x.forEach{a.put(encodeTrip(it))};p.edit().putString("trips",a.toString()).apply()}
 private fun encodeTrip(t:Trip)=JSONObject().apply{
  put("id",t.id);put("at",t.createdAt);put("vendor",t.vendor);put("vehicle",t.vehicle);put("cur",t.currentLocation);put("from",t.from);put("to",t.to)
  put("freight",t.freight);put("net",t.netFreight);put("advance",t.advance);put("weight",t.weightTon);put("originKm",t.currentToOriginKm);put("km",t.totalKm);put("hours",t.transitHours);put("mileage",t.mileage);put("fuelRate",t.fuelRate);put("fixed",t.fixedExpenses);put("fastag",t.fastag);put("rto",t.rtoTarpaulin);put("lu",t.loadingUnloading)
  put("rules",JSONArray().apply{t.expenseRules.forEach{put(JSONObject().put("n",it.name).put("p",it.percent))}})
 }
 private fun decodeTrip(o:JSONObject):Trip{
  val r=o.optJSONArray("rules")?:JSONArray();val rules=MutableList(r.length()){i->r.getJSONObject(i).let{ExpenseRule(it.getString("n"),it.getDouble("p"))}}
  return Trip(o.getString("id"),o.getLong("at"),o.getString("vendor"),o.getString("vehicle"),o.getString("cur"),o.getString("from"),o.getString("to"),o.getDouble("freight"),o.optDouble("net",o.getDouble("freight")),o.getDouble("advance"),o.getDouble("weight"),o.optDouble("originKm",0.0),o.getDouble("km"),o.getDouble("hours"),o.getDouble("mileage"),o.getDouble("fuelRate"),o.getDouble("fixed"),o.getDouble("fastag"),o.getDouble("rto"),o.getDouble("lu"),rules)
 }
}