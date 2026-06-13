/*
NOTIFICATION SYSTEM INTEGRATION GUIDE
====================================

This guide explains how to integrate the in-app notification system into your Expo app.

FILES CREATED:
  ✓ utils/NotificationContext.tsx  — Context provider for managing notification state
  ✓ utils/notifications.ts          — Helper functions for specific notification scenarios
  ✓ components/NotificationBanner.tsx — UI component to display notifications

STEP-BY-STEP INTEGRATION:
========================

1. Update app/_layout.tsx
   - Import NotificationProvider and NotificationBanner
   - Wrap the app structure with NotificationProvider
   - Render NotificationBanner at the top level for visibility

2. Use notifications in your components
   - Import useNotification hook
   - Call notification helper functions to display alerts

DETAILED INTEGRATION STEPS:
==========================

## STEP 1: Update app/_layout.tsx

Add these imports at the top of the file:

    import { NotificationProvider } from "../utils/NotificationContext";
    import NotificationBanner from "../components/NotificationBanner";

Update the RootLayout export to wrap with NotificationProvider:

    export default function RootLayout() {
      return (
        <ThemeProvider>
          <AuthProvider>
            <ParkingProvider>
              <NotificationProvider>
                <InnerLayout />
              </ParkingProvider>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      );
    }

Add NotificationBanner to the InnerLayout function (after the StatusBar):

    function InnerLayout() {
      // ...existing code...
      
      return (
        <>
          <StatusBar style={statusBarStyle} />
          <NotificationBanner /> {/* Add this line */}
          
          {/* ...rest of InnerLayout... */}
        </>
      );
    }


## STEP 2: Use notifications in your parking-related components

Example: When parking booking is confirmed

    import { useNotification } from "../utils/NotificationContext";
    import { notifyParkingBooked } from "../utils/notifications";
    
    export function BookingButton() {
      const { addNotification } = useNotification();
      
      const handleConfirmBooking = async () => {
        try {
          // ... booking logic ...
          notifyParkingBooked(addNotification);
        } catch (error) {
          // ... error handling ...
        }
      };
      
      return (
        // ...component JSX...
      );
    }

Example: When parking expiration timer reaches 15 minutes

    import { useNotification } from "../utils/NotificationContext";
    import { notifyParkingExpiringIn15Min } from "../utils/notifications";
    
    export function ParkingTimer() {
      const { addNotification } = useNotification();
      
      useEffect(() => {
        // Check if parking is expiring in 15 minutes
        if (timeRemainingMs === 15 * 60 * 1000) {
          notifyParkingExpiringIn15Min(addNotification);
        }
      }, [timeRemainingMs, addNotification]);
      
      return (
        // ...component JSX...
      );
    }

## STEP 3: Available Notification Functions

From utils/notifications.ts, you can use:

1. notifyParkingExpiringIn15Min(addNotification)
   - Displays: "Your parking expires in 15 minutes."
   - Type: warning
   - Duration: 6 seconds

2. notifyParkingBooked(addNotification)
   - Displays: "Your parking spot has been successfully booked."
   - Type: success
   - Duration: 5 seconds

3. notifyParkingBookingError(addNotification, errorMessage?)
   - Displays custom error or default message
   - Type: error
   - Duration: 6 seconds

4. notifyParkingExpired(addNotification)
   - Displays: "Your parking time has expired."
   - Type: error
   - Duration: 6 seconds

5. createCustomNotification(addNotification, message, type, duration)
   - createCustomNotification(addNotification, "Custom message", "info", 5000)
   - Type: success | warning | error | info
   - Duration: custom (0 = never auto-close)

## STEP 4: Customization

### Adjust auto-close durations
Edit utils/notifications.ts and modify the duration parameters in each function.

### Customize notification styling
Edit components/NotificationBanner.tsx to:
  - Change colors (getBackgroundColor function)
  - Modify icon appearances
  - Add animations using React Native Animated API
  - Change position (top vs bottom) when rendering: <NotificationBanner position="bottom" />

### Limit visible notifications
When rendering NotificationBanner, use the maxVisibleNotifications prop:
  <NotificationBanner maxVisibleNotifications={5} />

## HOOK USAGE IN COMPONENTS

useNotification Hook API:

    const {
      notifications,              // Current array of active notifications
      addNotification,            // Function to add new notification
      dismissNotification,        // Function to dismiss by ID
      clearAllNotifications,      // Function to clear all notifications
    } = useNotification();

All notification helper functions require passing addNotification:

    const { addNotification } = useNotification();
    notifyParkingBooked(addNotification);


NOTIFICATION TYPE COLORS:
=======================

The NotificationBanner automatically colors notifications based on type:

- success   : Green (#10B981)  — For successful operations
- warning   : Orange (#F59E0B) — For alerts and warnings
- error     : Red (#EF4444)    — For errors and failures
- info      : Blue (#3B82F6)   — For general information


TESTING THE SYSTEM:
===================

To test, you can manually call notifications from any component:

    import { useNotification } from "../utils/NotificationContext";
    import { notifyParkingBooked } from "../utils/notifications";
    
    export function TestNotificationButton() {
      const { addNotification } = useNotification();
      
      return (
        <Button
          title="Test Notification"
          onPress={() => {
            // Test all notification types
            notifyParkingBooked(addNotification);
            // Try others:
            // notifyParkingExpiringIn15Min(addNotification);
            // notifyParkingBookingError(addNotification, "Custom error");
            // notifyParkingExpired(addNotification);
          }}
        />
      );
    }


TROUBLESHOOTING:
================

Q: "useNotification must be used within a NotificationProvider"
A: Make sure NotificationProvider wraps your component in _layout.tsx

Q: Notification doesn't appear
A: Verify NotificationBanner is rendered in app/_layout.tsx InnerLayout

Q: Multiple notifications overlap
A: Adjust NotificationBanner maxVisibleNotifications prop or stack spacing

Q: Different style needed
A: Customize components/NotificationBanner.tsx styling and colors
*/

export {};
