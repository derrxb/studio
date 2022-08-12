import * as React from 'react';

import { useAsync } from '@react-hookz/web';
import { useStyletron } from 'styletron-react';

import {
  Modal,
  ModalBody,
  ModalButton,
  ModalFooter,
  ModalHeader,
  ROLE,
  SIZE,
} from 'baseui/modal';
import { KIND as BUTTON_KIND } from 'baseui/button';

import { RecativeBlock } from 'components/Block/Block';
import { EmptySpace } from 'components/EmptyState/EmptyState';

import { ModalManager } from 'utils/hooks/useModalManager';

import { server } from 'utils/rpc';

import { BundleOptionItem } from './BundleOptionItem';

export interface ICreateBundleModalProps {
  onSubmit: () => void;
}

const ulStyles = {
  paddingLeft: '0',
  paddingRight: '0',
  listStyle: 'none',
};

export const useCreateBundleModal = ModalManager(null);

export const CreateBundleModal: React.FC<ICreateBundleModalProps> = ({
  onSubmit,
}) => {
  const [profiles, profilesActions] = useAsync(server.listBundleProfile);

  const [css] = useStyletron();
  const [showBundleOption, , , onClose] = useCreateBundleModal();

  React.useEffect(() => {
    profilesActions.execute();
  }, [profilesActions, profilesActions.execute]);

  if (profiles.status === 'not-executed' || profiles.status === 'loading') {
    return null;
  }

  return (
    <Modal
      onClose={onClose}
      isOpen={showBundleOption}
      animate
      autoFocus
      closeable={false}
      size={SIZE.default}
      role={ROLE.dialog}
    >
      <ModalHeader>Create Bundle</ModalHeader>
      <ModalBody>
        {profiles.result?.length ? (
          <ul className={css(ulStyles)}>
            {profiles.result?.map((x) => {
              return (
                <BundleOptionItem
                  key={x.id}
                  title={x.label}
                  description={x.bundleExtensionId}
                />
              );
            })}
          </ul>
        ) : (
          <RecativeBlock
            marginBottom="-32px"
            paddingTop="24px"
            paddingBottom="24px"
          >
            <EmptySpace
              title="No profile found"
              content="Create a profile in settings page"
            />
          </RecativeBlock>
        )}
      </ModalBody>
      <ModalFooter>
        <ModalButton kind={BUTTON_KIND.tertiary} onClick={onClose}>
          Cancel
        </ModalButton>
        <ModalButton kind={BUTTON_KIND.primary} onClick={onSubmit}>
          OK
        </ModalButton>
      </ModalFooter>
    </Modal>
  );
};