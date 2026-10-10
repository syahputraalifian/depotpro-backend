package com.depotpro.app.data.model

import com.google.gson.annotations.SerializedName

data class User(
    @SerializedName("id") val id: String? = null,
    @SerializedName("email") val email: String,
    @SerializedName("name") val name: String,
    @SerializedName("role") val role: String,
    @SerializedName("base_salary") val baseSalary: Double? = 0.0,
    @SerializedName("incentive_rate") val incentiveRate: Double? = 0.0
)
