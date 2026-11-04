package com.cubelogistics.placement
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
val CubeBlue=Color(0xFF073B7A); val CubeOrange=Color(0xFFFF6500)
@Composable fun CubeApp(store:Store){
 MaterialTheme(colorScheme=lightColorScheme(primary=CubeBlue,secondary=CubeOrange)){
  var logged by remember{mutableStateOf(false)}
  if(!logged) Login{logged=true} else Dashboard(store)
 }
}
@Composable fun Login(go:()->Unit){
 var u by remember{mutableStateOf("")}; var p by remember{mutableStateOf("")}
 Column(Modifier.fillMaxSize().padding(28.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.Center){
  Text("CUBE",style=MaterialTheme.typography.displayLarge,color=CubeBlue,fontWeight=FontWeight.Black)
  Text("LOGISTICS",style=MaterialTheme.typography.headlineSmall,color=CubeOrange,fontWeight=FontWeight.Bold)
  Spacer(Modifier.height(24.dp))
  OutlinedTextField(u,{u=it},label={Text("User ID")},modifier=Modifier.fillMaxWidth())
  Spacer(Modifier.height(10.dp))
  OutlinedTextField(p,{p=it},label={Text("Password")},modifier=Modifier.fillMaxWidth())
  Spacer(Modifier.height(20.dp))
  Button(go,Modifier.fillMaxWidth(),colors=ButtonDefaults.buttonColors(containerColor=CubeOrange)){Text("Login")}
 }
}
@Composable fun Dashboard(store:Store){
 var tab by remember{mutableStateOf("Dashboard")}
 Scaffold(topBar={TopAppBar(title={Text("CUBE LOGISTICS",fontWeight=FontWeight.Bold)},colors=TopAppBarDefaults.topAppBarColors(containerColor=CubeBlue,titleContentColor=Color.White))}){
  pad->Column(Modifier.padding(pad).padding(16.dp)){
   Text("Vehicle Placement",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=CubeBlue)
   Spacer(Modifier.height(12.dp))
   Card(Modifier.fillMaxWidth()){Column(Modifier.padding(16.dp)){Text("Transport Operations Dashboard");Text("Vehicle, Vendor, Location & Fuel Masters");Text("Trip Entry • Expenses • Margin • Reports")}}
   Spacer(Modifier.height(16.dp))
   listOf("New Trip","Trip List","Reports","Masters").forEach{Button({tab=it},Modifier.fillMaxWidth()){Text(it)};Spacer(Modifier.height(8.dp))}
   Text("Selected: "+tab,color=CubeOrange,fontWeight=FontWeight.Bold)
  }
 }
}