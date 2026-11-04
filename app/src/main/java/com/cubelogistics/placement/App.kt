package com.cubelogistics.placement

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

val CubeBlue=Color(0xFF073B7A)
val CubeOrange=Color(0xFFFF6500)

@Composable fun CubeApp(store:Store){
 MaterialTheme(colorScheme=lightColorScheme(primary=CubeBlue,secondary=CubeOrange)){
  var logged by remember{mutableStateOf(false)}
  if(!logged) Login{logged=true} else MainShell(store)
 }
}

@Composable fun Login(go:()->Unit){
 var user by remember{mutableStateOf("")}; var pass by remember{mutableStateOf("")}
 Column(Modifier.fillMaxSize().padding(28.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.Center){
  Text("CUBE",style=MaterialTheme.typography.displayLarge,color=CubeBlue,fontWeight=FontWeight.Black)
  Text("LOGISTICS",style=MaterialTheme.typography.headlineSmall,color=CubeOrange,fontWeight=FontWeight.Bold)
  Spacer(Modifier.height(24.dp))
  OutlinedTextField(user,{user=it},label={Text("User ID")},modifier=Modifier.fillMaxWidth())
  Spacer(Modifier.height(8.dp))
  OutlinedTextField(pass,{pass=it},label={Text("Password")},modifier=Modifier.fillMaxWidth())
  Spacer(Modifier.height(16.dp))
  Button(go,Modifier.fillMaxWidth()){Text("Login")}
 }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun MainShell(store:Store){
 var page by remember{mutableStateOf("Dashboard")}
 Scaffold(topBar={TopAppBar(
  title={Text(if(page=="Dashboard") "CUBE LOGISTICS" else page)},
  navigationIcon={if(page!="Dashboard") TextButton({page="Dashboard"}){Text("Back",color=Color.White)}},
  colors=TopAppBarDefaults.topAppBarColors(containerColor=CubeBlue,titleContentColor=Color.White)
 )}){pad->Box(Modifier.padding(pad)){when(page){
  "Dashboard"->DashboardScreen(store){page=it}
  "Masters"->MastersScreen(store)
  "New Trip"->TripEntryScreen(store){page="Trip List"}
  "Trip List"->TripListScreen(store)
  "Reports"->ReportsScreen(store)
 }}}
}

@Composable fun DashboardScreen(store:Store,go:(String)->Unit){
 val trips=store.trips()
 Column(Modifier.fillMaxSize().padding(16.dp)){
  Text("Vehicle Placement Dashboard",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=CubeBlue)
  Spacer(Modifier.height(12.dp))
  Text("Trips: "+trips.size)
  Text("Freight: ₹"+fmt(trips.sumOf{it.freight})+"   Margin: ₹"+fmt(trips.sumOf{it.margin}))
  Spacer(Modifier.height(16.dp))
  listOf("New Trip","Trip List","Reports","Masters").forEach{p->Button({go(p)},Modifier.fillMaxWidth()){Text(p)};Spacer(Modifier.height(8.dp))}
 }
}

fun String.num():Double=toDoubleOrNull()?:0.0
fun fmt(v:Double)=String.format(java.util.Locale.US,"%.2f",v)
