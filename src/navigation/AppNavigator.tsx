import React, {useEffect, useRef} from 'react';
import {NavigationContainer, useNavigation, type LinkingOptions} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Feather';
import {CustomTabBar} from '../components/CustomTabBar';
import {HomeScreen} from '../screens/HomeScreen';
import {InventoryScreen} from '../screens/InventoryScreen';
import {AddInventoryScreen} from '../screens/AddInventoryScreen';
import {CaptureReceiptScreen} from '../screens/CaptureReceiptScreen';
import {ManualEntryScreen} from '../screens/ManualEntryScreen';
import {ReviewItemsScreen} from '../screens/ReviewItemsScreen';
// Barcode scanning disabled
// import {BarcodeScannerScreen} from '../screens/BarcodeScannerScreen';
// Estimate screens
import {EstimatesListScreen} from '../screens/EstimatesListScreen';
import {EstimateDetailScreen} from '../screens/EstimateDetailScreen';
import {CreateEstimateScreen} from '../screens/CreateEstimateScreen';
import {SelectInventoryForEstimateScreen} from '../screens/SelectInventoryForEstimateScreen';
import {SelectClientScreen} from '../screens/SelectClientScreen';
import {SelectLocationScreen} from '../screens/SelectLocationScreen';
import {CreateClientScreen} from '../screens/CreateClientScreen';
import {TemplatesListScreen} from '../screens/TemplatesListScreen';
// Job screens
import {JobsListScreen} from '../screens/JobsListScreen';
import {JobDetailScreen} from '../screens/JobDetailScreen';
import {CreateJobScreen} from '../screens/CreateJobScreen';
import {ClientProfileScreen} from '../screens/ClientProfileScreen';
import {EditClientScreen} from '../screens/EditClientScreen';
import {ClientsListScreen} from '../screens/ClientsListScreen';
import {ContactImportScreen} from '../screens/ContactImportScreen';
import {TeamContactImportScreen} from '../screens/TeamContactImportScreen';
import {SelectInventoryForJobScreen} from '../screens/SelectInventoryForJobScreen';
import {SettingsScreen} from '../screens/SettingsScreen';
import {CompanySettingsScreen} from '../screens/CompanySettingsScreen';
import {EditProfileScreen} from '../screens/EditProfileScreen';
// Team Management screens
import {TeamMembersScreen} from '../screens/TeamMembersScreen';
import {InviteTeamMemberScreen} from '../screens/InviteTeamMemberScreen';
import {TeamMemberProfileScreen} from '../screens/TeamMemberProfileScreen';
import {AssignTeamMembersScreen} from '../screens/AssignTeamMembersScreen';
import {TimeCardsScreen} from '../screens/TimeCardsScreen';
import {MyGoalsScreen} from '../screens/MyGoalsScreen';
import {WarehousesScreen} from '../screens/WarehousesScreen';
// Payment screens
import {ExportPaymentsScreen} from '../screens/payments/ExportPaymentsScreen';
// Subscription screens
import {PlanSelectionScreen} from '../screens/PlanSelectionScreen';
import {ManagePlanScreen} from '../screens/ManagePlanScreen';
// Notification screens
import {NotificationSettingsScreen} from '../screens/NotificationSettingsScreen';
// Auth screens
import {LoginScreen} from '../screens/auth/LoginScreen';
import {RegisterScreen} from '../screens/auth/RegisterScreen';
import {ForgotPasswordScreen} from '../screens/auth/ForgotPasswordScreen';
import {ResetPasswordScreen} from '../screens/auth/ResetPasswordScreen';
// Providers
import {AuthProvider, useAuth} from '../context/AuthContext';
import {TeamProvider} from '../context/TeamContext';
import {ClientProvider} from '../context/ClientContext';
import {InventoryProvider} from '../context/InventoryContext';
import {EstimateProvider} from '../context/EstimateContext';
import {JobProvider} from '../context/JobContext';
import {GoalProvider} from '../context/GoalContext';
import {TimeCardProvider} from '../context/TimeCardContext';
import {SubscriptionProvider} from '../context/SubscriptionContext';
import {PermissionProvider, usePermissions, PermissionKeys} from '../context/PermissionContext';
import {NotificationProvider} from '../context/NotificationContext';
import {ChangePasswordModal} from '../components/ChangePasswordModal';
import type {RootStackParamList, MainTabParamList, AuthStackParamList, HomeStackParamList} from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();

// Tab Bar Icon components (extracted to avoid eslint warnings)
const HomeTabIcon = ({color, size}: {color: string; size: number}) => (
  <Icon name="home" size={size} color={color} />
);
const InventoryTabIcon = ({color, size}: {color: string; size: number}) => (
  <Icon name="package" size={size} color={color} />
);
const EstimatesTabIcon = ({color, size}: {color: string; size: number}) => (
  <Icon name="file-text" size={size} color={color} />
);
const JobsTabIcon = ({color, size}: {color: string; size: number}) => (
  <Icon name="briefcase" size={size} color={color} />
);

// Auth Navigator
const AuthNavigator = () => {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </AuthStack.Navigator>
  );
};

// Tab icons for additional tabs
const TimeCardsTabIcon = ({color, size}: {color: string; size: number}) => (
  <Icon name="clock" size={size} color={color} />
);
// Settings tab icon (kept for future use)
// const SettingsTabIcon = ({color, size}: {color: string; size: number}) => (
//   <Icon name="settings" size={size} color={color} />
// );

// Home Stack Navigator - nests Home + ClientsList + TeamMembers + TemplatesList inside tab to preserve tab bar
const HomeStackNavigator = () => (
  <HomeStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <HomeStack.Screen name="HomeMain" component={HomeScreen} />
    <HomeStack.Screen name="ClientsList" component={ClientsListScreen} />
    <HomeStack.Screen name="TeamMembers" component={TeamMembersScreen} />
    <HomeStack.Screen name="TemplatesList" component={TemplatesListScreen} />
  </HomeStack.Navigator>
);

// Bottom Tab Navigator - Admin/Leader version
const AdminTabs = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#004732',
        tabBarInactiveTintColor: '#808080',
        tabBarStyle: { position: 'absolute', backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0 },
      }}>
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: HomeTabIcon,
        }}
      />
      <Tab.Screen
        name="JobsTab"
        component={JobsListScreen}
        options={{
          tabBarLabel: 'Jobs',
          tabBarIcon: JobsTabIcon,
        }}
      />
      <Tab.Screen
        name="EstimatesTab"
        component={EstimatesListScreen}
        options={{
          tabBarLabel: 'Estimates',
          tabBarIcon: EstimatesTabIcon,
        }}
      />
      <Tab.Screen
        name="InventoryTab"
        component={InventoryScreen}
        options={{
          tabBarLabel: 'Inventory',
          tabBarIcon: InventoryTabIcon,
        }}
      />
    </Tab.Navigator>
  );
};

// Bottom Tab Navigator - Crew version (permission-based access)
const CrewTabs = () => {
  const { hasPermission } = usePermissions();
  
  // Check permissions for each tab
  const canViewInventory = hasPermission(PermissionKeys.ViewInventory);
  const canViewEstimates = hasPermission(PermissionKeys.ViewEstimates);
  const canViewAllJobs = hasPermission(PermissionKeys.ViewAllJobs);
  
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#004732',
        tabBarInactiveTintColor: '#808080',
        tabBarStyle: { position: 'absolute', backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0 },
      }}>
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: HomeTabIcon,
        }}
      />
      <Tab.Screen
        name="JobsTab"
        component={JobsListScreen}
        options={{
          tabBarLabel: canViewAllJobs ? 'Jobs' : 'My Jobs',
          tabBarIcon: JobsTabIcon,
        }}
      />
      {canViewEstimates && (
        <Tab.Screen
          name="EstimatesTab"
          component={EstimatesListScreen}
          options={{
            tabBarLabel: 'Estimates',
            tabBarIcon: EstimatesTabIcon,
          }}
        />
      )}
      {canViewInventory && (
        <Tab.Screen
          name="InventoryTab"
          component={InventoryScreen}
          options={{
            tabBarLabel: 'Inventory',
            tabBarIcon: InventoryTabIcon,
          }}
        />
      )}
      <Tab.Screen
        name="TimeCardsTab"
        component={TimeCardsScreen}
        options={{
          tabBarLabel: 'Time Cards',
          tabBarIcon: TimeCardsTabIcon,
        }}
      />
    </Tab.Navigator>
  );
};

// Main Tabs wrapper that switches based on role
const MainTabs = () => {
  const { currentCompany } = useAuth();
  const role = currentCompany?.role?.toLowerCase() || '';
  const isAdminOrLeader = role === 'admin' || role === 'superadmin' || role === 'leader';
  
  return isAdminOrLeader ? <AdminTabs /> : <CrewTabs />;
};

// Component that redirects new registrations to PlanSelection
const NewRegistrationRedirect = () => {
  const {isNewRegistration, clearNewRegistration} = useAuth();
  const navigation = useNavigation<any>();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isNewRegistration && !hasRedirected.current) {
      hasRedirected.current = true;
      const timer = setTimeout(() => {
        navigation.navigate('PlanSelection', { fromRegistration: true });
        clearNewRegistration();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isNewRegistration, clearNewRegistration, navigation]);

  return null;
};

// Root Navigator with conditional auth
const RootNavigator = () => {
  const {isAuthenticated, isLoading, changePasswordRequired, changePassword, dismissChangePassword} = useAuth();

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animationTypeForReplace: 'pop',
        }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} options={{headerShown: false}} />
        ) : (
          <>
          {/* Main Tab Navigator */}
          <Stack.Screen name="MainTabs">
            {() => (
              <>
                <NewRegistrationRedirect />
                <MainTabs />
              </>
            )}
          </Stack.Screen>
            {/* Legacy screens for navigation compatibility */}
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Inventory" component={InventoryScreen} />
            <Stack.Screen name="EstimatesList" component={EstimatesListScreen} />
            {/* Inventory flow screens */}
            <Stack.Screen name="AddInventory" component={AddInventoryScreen} />
            <Stack.Screen name="CaptureReceipt" component={CaptureReceiptScreen} />
            <Stack.Screen name="ManualEntry" component={ManualEntryScreen} />
            <Stack.Screen name="ReviewItems" component={ReviewItemsScreen} />
            {/* Barcode scanning disabled */}
            {/* <Stack.Screen name="BarcodeScanner" component={BarcodeScannerScreen} /> */}
            {/* Estimate flow screens */}
            <Stack.Screen name="EstimateDetail" component={EstimateDetailScreen} />
            <Stack.Screen name="CreateEstimate" component={CreateEstimateScreen} />
            <Stack.Screen name="SelectInventoryForEstimate" component={SelectInventoryForEstimateScreen} />
            <Stack.Screen name="SelectClient" component={SelectClientScreen} />
            <Stack.Screen name="SelectLocation" component={SelectLocationScreen} />
            <Stack.Screen name="CreateClient" component={CreateClientScreen} />
            {/* Job flow screens */}
            <Stack.Screen name="JobsList" component={JobsListScreen} />
            <Stack.Screen name="JobDetail" component={JobDetailScreen} />
            <Stack.Screen name="CreateJob" component={CreateJobScreen} />
            <Stack.Screen name="ClientProfile" component={ClientProfileScreen} />
            <Stack.Screen name="EditClient" component={EditClientScreen} />
            <Stack.Screen name="ClientsList" component={ClientsListScreen} />
          <Stack.Screen name="ContactImport" component={ContactImportScreen} />
          <Stack.Screen name="TeamContactImport" component={TeamContactImportScreen} />
          <Stack.Screen name="SelectInventoryForJob" component={SelectInventoryForJobScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="CompanySettings" component={CompanySettingsScreen} />
          <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          {/* Team Management screens (Admin only) */}
          <Stack.Screen name="InviteTeamMember" component={InviteTeamMemberScreen} />
          <Stack.Screen name="TeamMemberProfile" component={TeamMemberProfileScreen} />
          <Stack.Screen name="AssignTeamMembers" component={AssignTeamMembersScreen} />
          <Stack.Screen name="TimeCards" component={TimeCardsScreen} />
          <Stack.Screen name="MyGoals" component={MyGoalsScreen} />
          <Stack.Screen name="Warehouses" component={WarehousesScreen} />
          <Stack.Screen name="ExportPayments" component={ExportPaymentsScreen} />
          {/* Subscription screens */}
          <Stack.Screen name="PlanSelection" component={PlanSelectionScreen} />
          <Stack.Screen name="ManagePlan" component={ManagePlanScreen} />
        </>
      )}
      </Stack.Navigator>
      
      {/* Change Password Modal - shown on first login for staff */}
      <ChangePasswordModal
        visible={changePasswordRequired}
        onChangePassword={changePassword}
        onClose={dismissChangePassword}
      />
    </>
  );
};

// Deep link configuration for password reset
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['silkroad://'],
  config: {
    screens: {
      Auth: {
        screens: {
          ResetPassword: 'reset-password',
        },
      },
    },
  },
};

export const AppNavigator = () => {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <PermissionProvider>
          <ClientProvider>
            <InventoryProvider>
              <EstimateProvider>
                <JobProvider>
                  <GoalProvider>
                    <TeamProvider>
                      <TimeCardProvider>
                        <NotificationProvider>
                          <NavigationContainer linking={linking}>
                            <RootNavigator />
                          </NavigationContainer>
                        </NotificationProvider>
                      </TimeCardProvider>
                    </TeamProvider>
                  </GoalProvider>
                </JobProvider>
              </EstimateProvider>
            </InventoryProvider>
          </ClientProvider>
        </PermissionProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
};

