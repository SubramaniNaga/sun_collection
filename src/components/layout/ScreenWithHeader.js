import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Header from '../common/Header';
import SideDrawer from './SideDrawer';
import ScreenWrapper from './ScreenWrapper';

const ScreenWithHeader = ({ 
  children, 
  title, 
  navigation, 
  showMenu = true, 
  rightComponent,
  headerStyle 
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const toggleDrawer = () => {
    setIsDrawerOpen(!isDrawerOpen);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
  };

  return (
    <View style={styles.container}>
      <Header
        title={title}
        onMenuPress={toggleDrawer}
        showMenu={showMenu}
        rightComponent={rightComponent}
      />
      <ScreenWrapper style={styles.content}>
        {children}
      </ScreenWrapper>
      <SideDrawer
        isVisible={isDrawerOpen}
        onClose={closeDrawer}
        navigation={navigation}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
});

export default ScreenWithHeader;
