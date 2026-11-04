package com.cubelogistics.placement

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable fun MastersScreen(store:Store){
 var tab by remember{mutableStateOf("Vehicles")}
 Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)){
  Row{listOf("Vehicles","Vendors","Locations","Fuel").forEach{TextButton({tab=it}){Text(it)}}}
  when(tab){
   "Vehicles"->VehicleMaster(store)
   "Vendors"->NameMaster("Vendor",store.vendors().map{it.name}){store.saveVendors(it.map(::Vendor))}
   "Locations"->NameMaster("Location",store.locations().map{it.name}){store.saveLocations(it.map(::Location))}
   "Fuel"->FuelMaster(store)
  }
 }
}

@Composable fun VehicleMaster(store:Store){
 var items by remember{mutableStateOf(store.vehicles())};var no by remember{mutableStateOf("")};var mileage by remember{mutableStateOf("")};var msg by remember{mutableStateOf("")}
 OutlinedTextField(no,{no=it.uppercase()},label={Text("Vehicle No")},modifier=Modifier.fillMaxWidth())
 OutlinedTextField(mileage,{mileage=it},label={Text("Mileage (2.5 to 6.0 km/L)")},modifier=Modifier.fillMaxWidth())
 Button({
  val m=mileage.num()
  msg=when{
   no.isBlank()->"Vehicle number is required"
   m<2.5||m>6.0->"Mileage must be between 2.5 and 6.0"
   items.any{it.number.equals(no,true)}->"Duplicate vehicle number"
   else->{items=(items+Vehicle(no.trim(),m)).toMutableList();store.saveVehicles(items);no="";mileage="";"Vehicle saved"}
  }
 }){Text("Add Vehicle")}
 Text(msg)
 items.forEach{v->Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(v.number+" • "+v.mileage+" km/L");TextButton({items=items.map{if(it.number==v.number)it.copy(active=!it.active) else it}.toMutableList();store.saveVehicles(items)}){Text(if(v.active)"Deactivate" else "Activate")}}}
}

@Composable fun NameMaster(label:String,initial:List<String>,save:(List<String>)->Unit){
 var items by remember{mutableStateOf(initial)};var name by remember{mutableStateOf("")};var msg by remember{mutableStateOf("")}
 OutlinedTextField(name,{name=it},label={Text(label+" Name")},modifier=Modifier.fillMaxWidth())
 Button({val n=name.trim();if(n.isBlank())msg=label+" name is required" else if(items.any{it.equals(n,true)})msg="Duplicate "+label else{items=items+n;save(items);name="";msg=label+" saved"}}){Text("Add "+label)}
 Text(msg);items.forEach{Text("• "+it)}
}

@Composable fun FuelMaster(store:Store){
 var rate by remember{mutableStateOf(store.fuelRate.toString())};var msg by remember{mutableStateOf("")}
 OutlinedTextField(rate,{rate=it},label={Text("Fuel Rate ₹/L")},modifier=Modifier.fillMaxWidth())
 Button({if(rate.num()>0){store.fuelRate=rate.num();msg="Fuel rate saved"}else msg="Enter a valid fuel rate"}){Text("Save Fuel Rate")}
 Text(msg)
}
