import * as React from 'react';

import { useStyletron } from 'styletron-react';
import type { StyleObject } from 'styletron-react';

import { Block } from 'baseui/block';
import { Card } from 'baseui/card';

export const containerStyles: StyleObject = {
  width: '100vw',
  height: 'calc(100vh - 30px)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

export const bodyStyles: StyleObject = {
  paddingTop: '24px',
  paddingBottom: '24px',
};

const footerStyles: StyleObject = {
  display: 'flex',
  justifyContent: 'flex-end',
};

interface IGuideFormLayoutProps {
  title: string | React.ReactElement;
  footer: React.ReactNode;
  children?: React.ReactNode;
}

export const GuideFormLayout: React.FC<IGuideFormLayoutProps> = ({
  title,
  footer,
  children,
}) => {
  const [css] = useStyletron();

  return (
    <Block className={css(containerStyles)}>
      <Card
        overrides={{
          Root: {
            style: () => ({
              width: '60%',
              maxWidth: '600px',
              minWidth: '400px',
              paddingTop: '20px',
              paddingRight: '20px',
              paddingBottom: '20px',
              paddingLeft: '20px',
            }),
          },
        }}
        title={title}
      >
        <Block className={css(bodyStyles)}>{children}</Block>
        <Block className={css(footerStyles)}>{footer}</Block>
      </Card>
    </Block>
  );
};
