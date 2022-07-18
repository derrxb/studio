import * as React from 'react';
import { useAtom } from 'jotai';
import { useStyletron } from 'styletron-react';
import type { StyleObject } from 'styletron-react';

import Avatar from 'boring-avatars';
import { Block } from 'baseui/block';
import { Button } from 'baseui/button';
import { DisplayXSmall, LabelLarge } from 'baseui/typography';
import type { ButtonOverrides } from 'baseui/button';

import { USER, USER_INFO_MODAL_OPEN } from 'stores/ProjectDetail';

import { server } from 'utils/rpc';

const LOGOUT_BUTTON_OVERRIDES: ButtonOverrides = {
  Root: {
    style: ({ $theme }) => {
      return {
        width: '80%',
        backgroundColor: $theme.colors.contentNegative,
      };
    },
  },
};

const BODY_STYLE: StyleObject = {
  border: '2px solid #DDD',
};

const AVATAR_CONTAINER: StyleObject = {
  lineHeight: '0',
};

const SUBTITLE_STYLES: StyleObject = {
  marginTop: '8px',
  opacity: '0.6',
};

const InternalUserInfo: React.VFC = () => {
  const [css] = useStyletron();
  const [user, setUser] = useAtom(USER);

  const [isUserInfoOpen, setIsUserInfoOpen] = useAtom(USER_INFO_MODAL_OPEN);

  const logoutButtonClick = React.useCallback(async () => {
    await server.userLogout();
    setUser(null);
    setIsUserInfoOpen(false);
  }, [setIsUserInfoOpen, setUser]);

  return (
    <Block
      width="100vw"
      height="calc(100vh - 30px)"
      display={isUserInfoOpen ? 'flex' : 'none'}
      justifyContent="center"
      alignItems="center"
      position="fixed"
      bottom="0"
      backgroundColor="#FFFFFF"
    >
      <Block minWidth="50%" className={css(BODY_STYLE)}>
        <Block
          paddingTop="80px"
          paddingBottom="80px"
          display="flex"
          justifyContent="center"
          alignItems="center"
        >
          <Block display="flex">
            <Block className={css(AVATAR_CONTAINER)} marginRight="32px">
              <Avatar size="100px" name={user?.label || 'Untitled'} />
            </Block>
            <Block
              display="flex"
              flexDirection="column"
              justifyContent="center"
            >
              <DisplayXSmall>{user?.label || 'NoName'}</DisplayXSmall>
              <Block className={css(SUBTITLE_STYLES)}>
                <LabelLarge>#{user?.id || '[empty]'}</LabelLarge>
              </Block>
            </Block>
          </Block>
        </Block>
        <Block
          paddingTop="48px"
          paddingBottom="48px"
          display="flex"
          justifyContent="center"
          alignItems="center"
          backgroundColor="#EEE"
        >
          <Button
            overrides={LOGOUT_BUTTON_OVERRIDES}
            onClick={logoutButtonClick}
          >
            Logout
          </Button>
        </Block>
      </Block>
    </Block>
  );
};

export const UserInfo = React.memo(InternalUserInfo);
