package com.cubelogistics.placement

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.util.UUID

@Composable fun TripEntryScreen(store:Store,done:()->Unit){
 val vehicles=remember{store.vehicles().filter{it.active}};val vendors=remember{store.vendors().filter{it.active}};val locs=remember{store.locations().filter{it.active}}
 var vendor by remember{mutableStateOf(vendors.firstOrNull()?.name?:"")};var vehicle by remember{mutableStateOf(vehicles.firstOrNull()?.number?:"")};var current by remember{mutableStateOf(locs.firstOrNull()?.name?:"")};var from by remember{mutableStateOf(locs.firstOrNull()?.name?:"")};var to by remember{mutableStateOf(locs.getOrNull(1)?.name?:"")}
 var freight by remember{mutableStateOf("")};var net by remember{mutableStateOf("")};var advance by remember{mutableStateOf("")};var weight by remember{mutableStateOf("")};var originKm by remember{mutableStateOf("")};var km by remember{mutableStateOf("")};var hours by remember{mutableStateOf("")};var pct by remember{mutableStateOf("")};var fastag by remember{mutableStateOf("")};var rto by remember{mutableStateOf("")};var loading by remember{mutableStateOf("")};var fixed by remember{mutableStateOf("")};var msg by remember{mutableStateOf("")}
 val mileage=vehicles.find{it.number==vehicle}?.mileage?:0.0;val f=freight.num();val a=advance.num();val fuel=if(mileage>0)km.num()/mileage*store.fuelRate else 0.0
 Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)){
  PickField("Vendor",vendors.map{it.name},vendor){vendor=it};PickField("Vehicle",vehicles.map{it.number},vehicle){vehicle=it};PickField("Current Location",locs.map{it.name},current){current=it};PickField("From",locs.map{it.name},from){from=it};PickField("To",locs.map{it.name},to){to=it}
  NumberField("Including Expenses Freight Amount",freight){freight=it};NumberField("Net Freight Amount",net){net=it};NumberField("Advance Amount",advance){advance=it}
  Text("Booking Type: "+if(a<=0)"To Pay at Unloading" else if(f>0)(a/f*100).toInt().toString()+"% Advance" else "-");Text("Balance Amount: ₹"+fmt(f-a))
  NumberField("Weight Ton",weight){weight=it};NumberField("Current Location to Origin KM",originKm){originKm=it};NumberField("Trip Total KM",km){km=it};NumberField("In-transit Hours",hours){hours=it}
  Text("Mileage: "+mileage+" km/L • Fuel Rate: ₹"+store.fuelRate+"/L");Text("Fuel Expense: ₹"+fmt(fuel))
  NumberField("Other Expense %",pct){pct=it};NumberField("FASTag Expense",fastag){fastag=it};NumberField("RTO / Tarpaulin",rto){rto=it};NumberField("Loading & Unloading",loading){loading=it};NumberField("Fixed Expenses",fixed){fixed=it}
  if(msg.isNotBlank())Text(msg,color=MaterialTheme.colorScheme.error)
  Button({if(vendor.isBlank()||vehicle.isBlank()||f<=0)msg="Vendor, vehicle and freight are required" else{val t=Trip(id=UUID.randomUUID().toString(),createdAt=System.currentTimeMillis(),vendor=vendor,vehicle=vehicle,currentLocation=current,from=from,to=to,freight=f,netFreight=if(net.num()>0)net.num() else f,advance=a,weightTon=weight.num(),currentToOriginKm=originKm.num(),totalKm=km.num(),transitHours=hours.num(),mileage=mileage,fuelRate=store.fuelRate,fixedExpenses=fixed.num(),fastag=fastag.num(),rtoTarpaulin=rto.num(),loadingUnloading=loading.num(),expenseRules=if(pct.num()>0)listOf(ExpenseRule("Other Expense",pct.num()))else emptyList());val all=store.trips();all.add(t);store.saveTrips(all);done()}},Modifier.fillMaxWidth()){Text("Save Trip")}
  Spacer(Modifier.height(30.dp))
 }
}
@Composable fun NumberField(label:String,value:String,on:(String)->Unit){OutlinedTextField(value,on,label={Text(label)},modifier=Modifier.fillMaxWidth());Spacer(Modifier.height(6.dp))}
@Composable fun PickField(label:String,items:List<String>,selected:String,on:(String)->Unit){var open by remember{mutableStateOf(false)};Box{OutlinedButton({open=true},Modifier.fillMaxWidth()){Text(label+": "+selected)};DropdownMenu(open,{open=false}){items.forEach{x->DropdownMenuItem(text={Text(x)},onClick={on(x);open=false})}}}}
