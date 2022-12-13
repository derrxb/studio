import * as React from 'react';

import { ISimpleRelease } from '@recative/definitions';

import { SIZE } from 'baseui/select';

import { Select } from 'components/Select/Select';
import { RecativeBlock } from 'components/Block/RecativeBlock';
import type { GetOptionLabel, GetValueLabel } from 'components/Select/Select';

import { useEvent } from 'utils/hooks/useEvent';

import { useSearchRelease } from './CommitForm';
import { LabelSmall, LabelXSmall } from 'baseui/typography';

interface IReleaseSelectProps {
  disabled?: boolean;
  value?: ISimpleRelease;
  placeholder?: string;
  type: 'code' | 'media';
  size?: typeof SIZE[keyof typeof SIZE];
  onChange?: (x: ISimpleRelease) => void;
}

const getValueLabel: GetValueLabel<ISimpleRelease> = ({ option }) => {
  return (
    <RecativeBlock display="flex">
      <RecativeBlock color="contentTertiary" marginRight="8px">
        #{option?.id}
      </RecativeBlock>
      <RecativeBlock>{option?.notes}</RecativeBlock>
    </RecativeBlock>
  );
};

const getOptionLabel: GetOptionLabel<ISimpleRelease> = ({ option }) => {
  return (
    <RecativeBlock>
      <LabelXSmall>#{option?.id}</LabelXSmall>
      <LabelSmall>
        <b>{option?.notes}</b>
      </LabelSmall>
    </RecativeBlock>
  );
};

export const ReleaseSelect: React.FC<IReleaseSelectProps> = ({
  disabled,
  value,
  placeholder,
  type,
  size,
  onChange,
}) => {
  const selectedRelease = React.useMemo(() => (value ? [value] : []), [value]);
  const handleChange = useEvent((x: { value: readonly ISimpleRelease[] }) =>
    onChange?.(x.value[0])
  );

  const [options, loading, handleInputChange] = useSearchRelease(type);

  return (
    <Select<ISimpleRelease>
      size={size}
      disabled={disabled}
      options={options}
      value={selectedRelease}
      placeholder={placeholder}
      isLoading={loading}
      OptionLabel={getOptionLabel}
      ValueLabel={getValueLabel}
      onChange={handleChange}
      onInputChange={handleInputChange}
    />
  );
};