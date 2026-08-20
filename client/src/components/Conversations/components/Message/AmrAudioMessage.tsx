import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import BenzAMRRecorder from 'benz-amr-recorder';
import type { FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './index.module.scss';
import UnsupportedMessage from './UnsupportedMessage';

interface AmrAudioMessageProps {
    audioUrl?: string;
}

const AmrAudioMessage: FC<AmrAudioMessageProps> = (props) => {
    const { audioUrl } = props;
    const { t } = useTranslation();
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState('00:00');
    const [currentProgress, setCurrentProgress] = useState('0');
    const [progressMax, setProgressMax] = useState('1');
    const [error, setError] = useState(false);
    const benzAmrRecorderRef = useRef<BenzAMRRecorder>();
    const durationRef = useRef<ReturnType<typeof setInterval>>();

    const togglePlayAudio = () => {
        if (benzAmrRecorderRef.current) {
            if (benzAmrRecorderRef.current.isPlaying()) {
                benzAmrRecorderRef.current.pause();
                setIsPlaying(false);
            } else if (benzAmrRecorderRef.current.isPaused()) {
                benzAmrRecorderRef.current.resume();
                setIsPlaying(true);
            } else {
                benzAmrRecorderRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    const getDuration = useCallback(() => {
        const currentPosition = benzAmrRecorderRef.current?.getCurrentPosition() || 0;

        setCurrentTime(new Date(currentPosition * 1000).toISOString().substring(14, 19));
        setCurrentProgress(currentPosition.toFixed(2));
    }, []);

    useEffect(() => {
        if (audioUrl) {
            if (benzAmrRecorderRef.current) {
                benzAmrRecorderRef.current.destroy();
            }

            benzAmrRecorderRef.current = new BenzAMRRecorder();

            // test file: https://benzleung.github.io/benz-amr-recorder/res/mario.amr
            // benzAmrRecorderRef.current
            //     ?.initWithUrl('https://benzleung.github.io/benz-amr-recorder/res/mario.amr')
            benzAmrRecorderRef.current
                ?.initWithUrl(audioUrl)
                .then(() => {
                    setProgressMax(benzAmrRecorderRef.current?.getDuration().toFixed(2) || '1');
                })
                .catch((e) => {
                    console.warn(e);
                    setError(true);
                });
        }
        return () => {
            benzAmrRecorderRef.current?.destroy();
        };
    }, [audioUrl]);

    useEffect(() => {
        if (isPlaying) {
            if (durationRef.current) {
                clearInterval(durationRef.current);
            }
            durationRef.current = setInterval(() => {
                getDuration();
            }, 10);
        } else if (durationRef.current) {
            clearInterval(durationRef.current);
        }
    }, [isPlaying, getDuration]);

    if (error) {
        return <UnsupportedMessage text={t('unsupported_audio')} />;
    }

    return (
        <div className={styles.messageContentAudioRoot}>
            <IconButton onClick={() => togglePlayAudio()}>{isPlaying ? <PauseIcon /> : <PlayArrowIcon />}</IconButton>
            <input type="range" min="0" max={progressMax} step="any" value={currentProgress} disabled></input>
            <Typography variant="caption">{currentTime}</Typography>
        </div>
    );
};

export default AmrAudioMessage;
