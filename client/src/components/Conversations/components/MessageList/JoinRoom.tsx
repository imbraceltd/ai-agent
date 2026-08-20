import LoadingButton from '@mui/lab/LoadingButton';
import { useTranslation } from 'react-i18next';

import { joinTeamConversationThunk } from '@/redux/slices/teamConversation';
import { useAppDispatch, useAppSelector } from '@/redux/store';

import styles from './index.module.scss';
import { CONVERSATION_MODE } from '@/constants/conversation';

function JoinRoom() {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const joinTeamConversationStatus = useAppSelector((state) => state.TeamConversation.joinTeamConversationStatus);
    const teamConversation = useAppSelector((state) => state.TeamConversation.teamConversation);
    return (
        <div className={styles.joinRoomButtonRoot}>
            <LoadingButton
                variant="contained"
                color="imbrace_blue"
                loading={joinTeamConversationStatus === 'FETCH_IN_PROGRESS'}
                fullWidth
                sx={{ maxWidth: '500px' }}
                onClick={() =>
                    teamConversation &&
                    dispatch(joinTeamConversationThunk({ teamConvId: teamConversation?.id, mode: CONVERSATION_MODE.MANUAL }))
                }
            >
                {t('conversation_room_join_conversation')}
            </LoadingButton>
        </div>
    );
}

export default JoinRoom;
