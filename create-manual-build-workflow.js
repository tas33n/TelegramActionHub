const fs = require('fs');

const workflowContent = `name: Manual APK Build

on:
  workflow_dispatch:
    inputs:
      version_name:
        description: 'Version name for the APK (e.g., 1.0.0)'
        required: true
        default: '1.0.0'
      build_type:
        description: 'Build type'
        required: true
        default: 'debug'
        type: choice
        options:
          - debug
          - release

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Setup Java JDK
        uses: actions/setup-java@v3
        with:
          distribution: 'adopt'
          java-version: '17'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Expo CLI
        run: npm install -g expo-cli eas-cli
      
      - name: Install EAS build dependencies
        run: npm install @expo/config-plugins @expo/prebuild-config
      
      - name: Create local properties
        run: echo "sdk.dir=\$ANDROID_HOME" > android/local.properties
      
      - name: Configure Gradle
        run: |
          mkdir -p android/app/src/main/assets
          mkdir -p android/app/build/intermediates/assets/release
          mkdir -p android/app/build/intermediates/assets/debug
      
      - name: Update version in app.json
        run: |
          VERSION=\${{ github.event.inputs.version_name }}
          jq '.expo.version = "'"\$VERSION"'"' app.json > app.json.tmp
          mv app.json.tmp app.json
      
      - name: Build Android APK
        run: |
          npx expo prebuild --platform android --no-install
          cd android
          if [ "\${{ github.event.inputs.build_type }}" = "release" ]; then
            ./gradlew assembleRelease
          else
            ./gradlew assembleDebug
          fi
      
      - name: Determine APK path
        id: apk-path
        run: |
          if [ "\${{ github.event.inputs.build_type }}" = "release" ]; then
            echo "path=android/app/build/outputs/apk/release/app-release.apk" >> \$GITHUB_OUTPUT
            echo "name=telegram-monitor-\${{ github.event.inputs.version_name }}-release.apk" >> \$GITHUB_OUTPUT
          else
            echo "path=android/app/build/outputs/apk/debug/app-debug.apk" >> \$GITHUB_OUTPUT
            echo "name=telegram-monitor-\${{ github.event.inputs.version_name }}-debug.apk" >> \$GITHUB_OUTPUT
          fi
      
      - name: Upload APK
        uses: actions/upload-artifact@v3
        with:
          name: app-apk
          path: \${{ steps.apk-path.outputs.path }}
          
      - name: Create Release
        id: create_release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v\${{ github.event.inputs.version_name }}
          release_name: Version \${{ github.event.inputs.version_name }}
          draft: false
          prerelease: \${{ github.event.inputs.build_type == 'debug' }}
          
      - name: Upload APK to Release
        uses: actions/upload-release-asset@v1
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        with:
          upload_url: \${{ steps.create_release.outputs.upload_url }}
          asset_path: \${{ steps.apk-path.outputs.path }}
          asset_name: \${{ steps.apk-path.outputs.name }}
          asset_content_type: application/vnd.android.package-archive

# Note: This workflow can be manually triggered from the GitHub Actions tab`;

fs.writeFileSync('.github/workflows/manual-build-apk.yml', workflowContent);
console.log('Manual build workflow file created successfully!');