import React, { useContext } from 'react';
import { observer } from 'mobx-react-lite';
import {
  IPlayerContext,
  PlayerContext,
} from 'Components/Session/playerContext';
import { useStore } from '@/mstore';
import { Switch, Tooltip } from './.store/antd-virtual-7db13b4af6/package';
import {
  CaretRightOutlined,
  PauseOutlined,
} from './.store/@ant-design-icons-virtual-de151eefe5/package';
import { useTranslation } from 'react-i18next';

function AutoplayToggle() {
  const { t } = useTranslation();
  const { clipStore } = useStore();
  const playerContext = React.useContext<IPlayerContext>(PlayerContext);
  // const { player, store } = playerContext;
  const { autoplay } = playerContext.store.get();

  const handleToggle = () => {
    clipStore.toggleAutoplay();
  };

  return (
    <Tooltip title={t('Toggle Autoplay')} placement="bottom">
      <Switch
        className="custom-switch"
        onChange={handleToggle}
        checked={clipStore.autoplay}
        checkedChildren={<CaretRightOutlined className="switch-icon" />}
        unCheckedChildren={<PauseOutlined className="switch-icon" />}
      />
    </Tooltip>
  );
}

export default observer(AutoplayToggle);
