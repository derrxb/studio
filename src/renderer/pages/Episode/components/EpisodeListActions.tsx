import * as React from 'react';

import { IEpisode } from '@recative/definitions';

import { RecativeBlock } from 'components/Block/RecativeBlock';
import { AddIconOutline } from 'components/Icons/AddIconOutline';
import { SmallIconButton } from 'components/Button/SmallIconButton';

import { useEvent } from 'utils/hooks/useEvent';

import { server } from 'utils/rpc';

export interface IEpisodeListActionsProps {
  episode: IEpisode;
  onRefreshEpisodeListRequest: () => void;
}

export const EpisodeListActions: React.FC<IEpisodeListActionsProps> = ({
  episode,
  onRefreshEpisodeListRequest,
}) => {
  const handleAddAssetClick = useEvent(async () => {
    const asset = await server.addEmptyAsset(episode.id);
    onRefreshEpisodeListRequest();
    return asset;
  });

  return (
    <RecativeBlock width="100%" textAlign="right">
      <SmallIconButton title="Add Episode">
        <AddIconOutline width={16} onClick={handleAddAssetClick} />
      </SmallIconButton>
    </RecativeBlock>
  );
};
