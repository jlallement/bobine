plugins {
    id("com.android.application")
}

android {
    namespace = "fr.bobine.pastilles"
    compileSdk = 36
    defaultConfig {
        applicationId = "fr.bobine.pastilles"
        minSdk = 30
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
