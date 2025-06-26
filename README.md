# 🔒 SiteLock

**SiteLock** is a Android application built with **React Native + TypeScript**, designed to **block unwanted websites** using **Android Accessibility Services**. By detecting and redirecting blocked URLs in real time, SiteLock provides a lightweight, non-root solution for managing digital distractions.
> ⚠️ **Note:** Although SiteLock is built with React Native, it currently supports **Android only** due to its dependence on Android Accessibility Services and native Android modules.



## 🚀 Features

- 🔗 URL blocking via Accessibility Service
- ⚙️ Custom native Kotlin modules for enhanced control
- 📱 Easy-to-use interface built with React Native and TypeScript
- ⏰ Configurable blocked websites with schedules and time restrictions
- 🔒 Privacy-First Approach. All blocking logic runs on-device — no internet access or external tracking involved.

## 🛠️ Setup Instructions
> 💡 **Before you start:**  
> Ensure your development environment is set up by following the official [React Native Environment Setup Guide](https://reactnative.dev/docs/environment-setup) (choose the **React Native CLI** tab).

### Step 1: Clone the repository
   ```bash
   git clone https://github.com/aljazw/web-blocker-android.git
   cd web-blocker-android
   npm install
   ```
### Step 2: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

### Step 3: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android app:

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

If everything is set up correctly, you should see your new app running in the Android Emulator or your connected device.

This is one way to run your app — you can also build it directly from Android Studio.

### Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

## 🤝 Contributing
*I'm still learning and this project is a work in progress — so if you spot any messy code, bad practices, or things that could be done better, please feel free to jump in and help!*  
*Whether it's a code improvement, performance tip, or just cleaning things up — your suggestions and pull requests are very welcome.*

## 📄 License

*This project is licensed under the [MIT License](LICENSE).*
*Feel free to use, modify, and distribute this code freely. See the `LICENSE` file for more details.*



