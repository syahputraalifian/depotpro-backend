package com.depotpro.app.data.api

import com.google.gson.Gson
import com.google.gson.JsonObject
import retrofit2.HttpException
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

/** Mengubah exception jaringan/HTTP menjadi pesan yang ramah untuk pengguna. */
fun Throwable.toUserMessage(): String = when (this) {
    is HttpException -> httpMessage(this)
    is SocketTimeoutException -> "Server lama merespons (mungkin sedang bangun). Coba lagi sebentar lagi."
    is UnknownHostException -> "Tidak ada koneksi internet."
    is IOException -> "Tidak dapat terhubung ke server. Periksa koneksi internet."
    else -> message ?: "Terjadi kesalahan tak terduga."
}

private fun httpMessage(e: HttpException): String {
    val raw = try {
        e.response()?.errorBody()?.string()
    } catch (_: Exception) {
        null
    }
    val detail = raw?.let { parseDetail(it) }
    if (!detail.isNullOrBlank()) return detail
    return when (e.code()) {
        401 -> "Sesi berakhir, silakan login kembali."
        403 -> "Anda tidak memiliki izin untuk aksi ini."
        404 -> "Data tidak ditemukan."
        429 -> "Terlalu banyak percobaan. Coba lagi beberapa menit lagi."
        in 500..599 -> "Server sedang bermasalah. Coba lagi nanti."
        else -> "Permintaan gagal (kode ${e.code()})."
    }
}

private fun parseDetail(raw: String): String? {
    return try {
        val obj = Gson().fromJson(raw, JsonObject::class.java) ?: return null
        val detail = obj.get("detail")
        when {
            detail == null || detail.isJsonNull -> {
                val message = obj.get("message")
                if (message != null && message.isJsonPrimitive) message.asString else null
            }
            detail.isJsonPrimitive -> detail.asString
            detail.isJsonArray -> {
                val first = detail.asJsonArray.firstOrNull()
                val msg = if (first != null && first.isJsonObject) first.asJsonObject.get("msg") else null
                if (msg != null && msg.isJsonPrimitive) "Data tidak valid: ${msg.asString}" else "Data tidak valid."
            }
            else -> null
        }
    } catch (_: Exception) {
        null
    }
}
