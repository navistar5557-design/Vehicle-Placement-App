package com.cubelogistics.placement

data class Vehicle(val number:String,val mileage:Double,val active:Boolean=true)
data class Vendor(val name:String,val active:Boolean=true)
data class Location(val name:String,val active:Boolean=true)
data class ExpenseRule(val name:String,val percent:Double)

data class Trip(
 val id:String,val createdAt:Long,val vendor:String,val vehicle:String,
 val currentLocation:String,val from:String,val to:String,
 val freight:Double,val netFreight:Double,val advance:Double,val weightTon:Double,
 val currentToOriginKm:Double,val totalKm:Double,val transitHours:Double,
 val mileage:Double,val fuelRate:Double,val fixedExpenses:Double,val fastag:Double,
 val rtoTarpaulin:Double,val loadingUnloading:Double,val expenseRules:List<ExpenseRule>,
 val loadingExpensePerTon:Double=0.0,val unloadingExpensePerTon:Double=0.0,
 val createdBy:String="",val createdByEmail:String=""
){
 val balance get()=freight-advance
 val advancePercent get()=if(freight>0)advance/freight*100 else 0.0
 val bookingType get()=if(advance<=0)"To Pay at Unloading" else advancePercent.toInt().toString()+"% Advance"
 val perTonRate get()=if(weightTon>0)freight/weightTon else 0.0
 val perKmFreight get()=if(totalKm>0)freight/totalKm else 0.0
 val percentageExpenses get()=expenseRules.sumOf{freight*it.percent/100.0}
 val fuelExpense get()=if(mileage>0)(totalKm/mileage)*fuelRate else 0.0
 val loadingExpense get()=loadingExpensePerTon*weightTon
 val unloadingExpense get()=unloadingExpensePerTon*weightTon
 val totalExpenses get()=percentageExpenses+fuelExpense+fixedExpenses+fastag+rtoTarpaulin+loadingUnloading+loadingExpense+unloadingExpense
 val margin get()=freight-totalExpenses
 val marginPercent get()=if(freight>0)margin/freight*100 else 0.0
}