Write-Host "Building Web Assets..."
npm run build
Write-Host "Syncing to Android..."
npx cap sync android

$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
cd android
Write-Host "Building APK..."
.\gradlew.bat assembleDebug
cd ..

Write-Host "Copying APK to /apk folder..."
if (!(Test-Path -Path "apk")) {
    New-Item -ItemType Directory -Path "apk" | Out-Null
}
Copy-Item "android\app\build\outputs\apk\debug\app-debug.apk" -Destination "apk\SyncApp_android.apk" -Force
Write-Host "APK successfully built and copied to apk\SyncApp_android.apk!"
