import React, { useCallback, useEffect, useState } from 'react';
import AppAlert from '../components/common/AppAlert';
import { setAlertRenderer } from '../utils/alertService';

const AlertProvider = ({ children }) => {
  const [alert, setAlert] = useState(null);

  const hideAlert = useCallback(() => {
    setAlert(null);
  }, []);

  useEffect(() => {
    setAlertRenderer((config) => {
      setAlert({
        ...config,
        buttons: config.buttons?.length ? config.buttons : [{ text: 'OK', onPress: hideAlert }],
      });
    });
    return () => setAlertRenderer(null);
  }, [hideAlert]);

  return (
    <>
      {children}
      <AppAlert
        visible={!!alert}
        type={alert?.type}
        title={alert?.title}
        message={alert?.message}
        buttons={alert?.buttons}
        onClose={hideAlert}
      />
    </>
  );
};

export default AlertProvider;
