import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './FolderPickerMenu';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const FolderPickerMenuAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const FolderPickerMenu = useModuleLoader(Bundles.Extra, 'StatusPickerMenu', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return FolderPickerMenu ? <FolderPickerMenu {...props} /> : undefined;
};

export default FolderPickerMenuAsync;
