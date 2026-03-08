# 🅿️ MDIS Campus Parking App

A mobile parking management app built for **MDIS EduCity, Iskandar Puteri, Johor**.  
Developed using **React Native + Expo Router** as part of a mobile development assignment.

---

## 📱 Features

- **Splash Screen** — Animated MDIS branding with loading bar
- **Dashboard (Home)** — Live parking availability, stats, GPS navigation to campus
- **Parking Map** — Interactive spot grid based on actual MDIS lot layout
  - Real-time free/occupied status
  - ♿ OKU reserved spots (top-left)
  - Entrance (bottom-right) & Exit (top-right) indicators
  - GPS detection — find which spot you're parked at
  - OKU warning alert for unauthorised parking
- **Check In (Camera)** — Enter plate number to verify and check in
- **History** — View past parking sessions with annual pass status
- **Profile** — Student info, vehicle registration (max 4), avatar photo picker

---

## 🚗 Parking Rules

- **Student parking only** — teachers park elsewhere
- **Annual fee:** RM10 per vehicle
- **Max vehicles per student:** 4
- **OKU spots:** 2 reserved spaces, registered OKU students only
- **One-way traffic:** Enter from bottom-right, exit from top-right

---

## 🛠️ Tech Stack

| Tool | Purpose |
|------|---------|
| React Native | Mobile framework |
| Expo Router | File-based navigation |
| expo-location | GPS spot detection |
| expo-image-picker | Profile photo (camera & gallery) |
| AsyncStorage | Save registered plates locally |

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Install Expo-specific packages

```bash
npx expo install expo-location
npx expo install expo-image-picker
```

### 3. Start the app

```bash
npx expo start
```

### 4. View on your phone

- Download **Expo Go** from App Store / Google Play
- Scan the QR code shown in the terminal
- The app will reload automatically every time you save a file ✨

---

## 📁 Project Structure

```
app/
├── index.tsx              ← Splash screen
├── _layout.tsx            ← Root stack layout
├── camera.tsx             ← Plate check-in screen
└── (tabs)/
    ├── _layout.tsx        ← Bottom tab bar
    ├── home.tsx           ← Dashboard
    ├── map.tsx            ← Parking map
    ├── history.tsx        ← Parking history
    └── profile.tsx        ← Student profile & vehicles

utils/
├── storage.ts             ← AsyncStorage helpers (save/load plates)
├── ParkingContext.tsx     ← AsyncStorage helpers (save/load map)
└── ThemeContext.tsx       ← AsyncStorage helpers (save/load theme)

assets/
└── images/
    └── itkia.jpg          ← Logo image
```

---

## 👨‍🎓 Student Info

| | |
|---|---|
| **School** | MDIS Malaysia — EduCity, Iskandar Puteri, Johor |
| **Course** | Diploma in Information Technology |
| **Project** | Mobile Application Group Assignment |

---

## 📝 Notes

- All parking data is currently **mock/demo data** — no live backend connected
- GPS spot detection uses approximate coordinates based on the MDIS lot satellite image
- To simulate an OKU student, set `isOKU: true` in `CURRENT_USER` inside `map.tsx`
