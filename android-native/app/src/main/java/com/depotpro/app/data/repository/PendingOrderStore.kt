package com.depotpro.app.data.repository

import android.content.Context
import com.depotpro.app.data.model.FailedOrder
import com.depotpro.app.data.model.Order
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * Penyimpanan lokal transaksi yang dibuat saat offline (antrean) dan yang ditolak server saat dikirim ulang.
 * Aman dikirim ulang: setiap transaksi punya id unik dan server bersifat idempoten.
 */
class PendingOrderStore(context: Context) {

    private val prefs = context.getSharedPreferences("pending_orders", Context.MODE_PRIVATE)
    private val gson = Gson()
    private val orderListType = object : TypeToken<List<Order>>() {}.type
    private val failedListType = object : TypeToken<List<FailedOrder>>() {}.type

    @Synchronized
    fun pending(): List<Order> = readOrders()

    @Synchronized
    fun failed(): List<FailedOrder> = readFailed()

    @Synchronized
    fun addPending(order: Order) {
        val list = readOrders().toMutableList()
        if (list.none { it.id == order.id }) list.add(order)
        prefs.edit().putString(KEY_PENDING, gson.toJson(list)).apply()
    }

    @Synchronized
    fun removePending(id: String?) {
        if (id == null) return
        val list = readOrders().filter { it.id != id }
        prefs.edit().putString(KEY_PENDING, gson.toJson(list)).apply()
    }

    @Synchronized
    fun moveToFailed(order: Order, message: String) {
        removePending(order.id)
        val list = readFailed().filter { it.order.id != order.id }.toMutableList()
        list.add(FailedOrder(order, message))
        prefs.edit().putString(KEY_FAILED, gson.toJson(list)).apply()
    }

    @Synchronized
    fun retryFailed(id: String) {
        val failed = readFailed()
        val target = failed.firstOrNull { it.order.id == id } ?: return
        prefs.edit().putString(KEY_FAILED, gson.toJson(failed.filter { it.order.id != id })).apply()
        addPending(target.order)
    }

    @Synchronized
    fun discardFailed(id: String) {
        prefs.edit().putString(KEY_FAILED, gson.toJson(readFailed().filter { it.order.id != id })).apply()
    }

    @Synchronized
    fun clearAll() {
        prefs.edit().remove(KEY_PENDING).remove(KEY_FAILED).apply()
    }

    private fun readOrders(): List<Order> = try {
        gson.fromJson<List<Order>>(prefs.getString(KEY_PENDING, null), orderListType) ?: emptyList()
    } catch (e: Exception) {
        emptyList()
    }

    private fun readFailed(): List<FailedOrder> = try {
        gson.fromJson<List<FailedOrder>>(prefs.getString(KEY_FAILED, null), failedListType) ?: emptyList()
    } catch (e: Exception) {
        emptyList()
    }

    private companion object {
        const val KEY_PENDING = "pending"
        const val KEY_FAILED = "failed"
    }
}
