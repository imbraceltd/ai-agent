import { EllipsisText } from '@imbrace/ui';
import type { FC } from 'react';

import styles from './index.module.scss';

interface TeamTagsProps {
    teamName?: string;
}

const TeamTags: FC<TeamTagsProps> = (props) => {
    const { teamName } = props;

    const renderTeamName = () => {
        if (teamName) {
            return <EllipsisText text={teamName} className={styles.tag} />;
        }
        return null;
    };

    return <div className={styles.tagContainer}>{renderTeamName()}</div>;
};

export default TeamTags;
