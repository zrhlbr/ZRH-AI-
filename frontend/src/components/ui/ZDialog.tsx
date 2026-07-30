import { ReactNode } from 'react';
import { ZModal } from './ZModal';
import { ZButton } from './ZButton';

export interface ZDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  children: ReactNode;
  confirmText?: ReactNode;
  cancelText?: ReactNode;
  danger?: boolean;
  loading?: boolean;
}

/** ZRH Dialog — 统一确认对话框（基于 ZModal） */
export function ZDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmText = 'OK',
  cancelText = 'Cancel',
  danger,
  loading,
}: ZDialogProps) {
  return (
    <ZModal
      open={open}
      onClose={onClose}
      title={title}
      widthClass="max-w-sm"
      footer={
        <>
          <ZButton variant="ghost" size="sm" onClick={onClose}>
            {cancelText}
          </ZButton>
          <ZButton
            variant={danger ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </ZButton>
        </>
      }
    >
      {children}
    </ZModal>
  );
}
