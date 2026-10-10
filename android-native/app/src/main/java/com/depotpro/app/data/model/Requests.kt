package com.depotpro.app.data.model

import com.google.gson.annotations.SerializedName

data class UpdateStatusRequest(
    @SerializedName("status") val status: String,
    @SerializedName("gallons_returned") val gallonsReturned: Int = 0,
    @SerializedName("lpg_returned") val lpgReturned: Int = 0
)

data class PayRequest(
    @SerializedName("amount") val amount: Double
)

/** Bentuk respons server untuk endpoint yang membungkus hasil dalam {"success": true, "data": ...}. */
data class DataEnvelope<T>(
    @SerializedName("success") val success: Boolean? = null,
    @SerializedName("data") val data: T? = null
)

data class SimpleResponse(
    @SerializedName("success") val success: Boolean? = null,
    @SerializedName("message") val message: String? = null
)
