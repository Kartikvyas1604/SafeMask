import React, { useState, useImperativeHandle, forwardRef } from 'react';
import CustomAlert, { AlertButton, AlertType } from './CustomAlert';

export interface AlertRef {
  show: (props: {
    title: string;
    message?: string;
    type?: AlertType;
    buttons?: AlertButton[];
    transactionHash?: string;
    transactionStatus?: 'pending' | 'confirmed' | 'failed';
    showExplorerLink?: boolean;
    explorerUrl?: string;
    onCopyHash?: () => void;
    onViewExplorer?: () => void;
  }) => void;
}

const AlertProvider = forwardRef<AlertRef>((props, ref) => {
  const [visible, setVisible] = useState(false);
  const [alertProps, setAlertProps] = useState<{
    title: string;
    message?: string;
    type?: AlertType;
    buttons?: AlertButton[];
    transactionHash?: string;
    transactionStatus?: 'pending' | 'confirmed' | 'failed';
    showExplorerLink?: boolean;
    explorerUrl?: string;
    onCopyHash?: () => void;
    onViewExplorer?: () => void;
  }>({
    title: '',
  });

  useImperativeHandle(ref, () => ({
    show: (props) => {
      setAlertProps(props);
      setVisible(true);
    },
  }));

  const handleClose = () => {
    setVisible(false);
  };

  return (
    <CustomAlert
      visible={visible}
      title={alertProps.title}
      message={alertProps.message}
      type={alertProps.type}
      buttons={alertProps.buttons}
      transactionHash={alertProps.transactionHash}
      transactionStatus={alertProps.transactionStatus}
      showExplorerLink={alertProps.showExplorerLink}
      explorerUrl={alertProps.explorerUrl}
      onCopyHash={alertProps.onCopyHash}
      onViewExplorer={alertProps.onViewExplorer}
      onClose={handleClose}
    />
  );
});

AlertProvider.displayName = 'AlertProvider';

export default AlertProvider;

