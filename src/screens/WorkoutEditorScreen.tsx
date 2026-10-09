import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Exercise, ExerciseMode, RootStackNavigation, RootStackParamList, Workout } from '../types/types';
import BackButton from '../components/BackButton';
import TextField from '../components/TextField';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import Card from '../components/Card';
import Dialog, { confirmActions } from '../components/Dialog';
import ErrorPopup from '../components/ErrorPopup';
import IconButton from '../components/IconButton';
import SectionHeader from '../components/SectionHeader';
import Segmented from '../components/Segmented';
import Stepper from '../components/Stepper';
import { ThemedText } from '../components/ThemedText';
import { animateLayout } from '../components/Motion';
import { useTheme } from '../context/ThemeContext';
import { gutter, spacing } from '../theme';
import { formatSeconds } from '../utils/apnea';
import { newId } from '../utils/dates';
import { describeExercise, describeWorkout, LIMITS, newExercise } from '../utils/workout';
import { deleteWorkout, getWorkouts, saveWorkout } from '../storage';
import { haptics } from '../utils/haptics';
import { ERRORS } from '../constants/strings';

const MAX_NAME = 60;
const MAX_EXERCISES = 30;

const MODES: { value: ExerciseMode; label: string }[] = [
    { value: 'reps', label: 'Reps' },
    { value: 'time', label: 'Timed' },
];

type Dialog = { kind: 'exercise'; exercise: Exercise; isNew: boolean } | { kind: 'delete' } | { kind: 'error' };

const WorkoutEditorScreen: React.FC = () => {
    const { theme } = useTheme();
    const navigation = useNavigation<RootStackNavigation>();
    const { params } = useRoute<RouteProp<RootStackParamList, 'WorkoutEditor'>>();
    const workoutId = params?.workoutId;

    const [existing, setExisting] = useState<Workout | null>(null);
    const [name, setName] = useState('');
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [dialog, setDialog] = useState<Dialog | null>(null);
    const close = () => setDialog(null);

    // Editing: load the workout once. If it no longer exists, leave.
    useEffect(() => {
        if (!workoutId) {
            return;
        }
        getWorkouts()
            .then(list => {
                const workout = list.find(w => w.id === workoutId);
                if (!workout) {
                    navigation.goBack();
                    return;
                }
                setExisting(workout);
                setName(workout.name);
                setExercises(workout.exercises);
            })
            .catch(() => setDialog({ kind: 'error' }));
    }, [workoutId, navigation]);

    const trimmed = name.trim();
    const problem = !trimmed ? 'Give your workout a name.' : !exercises.length ? 'Add at least one exercise.' : null;

    const putExercise = (exercise: Exercise) => {
        animateLayout();
        setExercises(list =>
            list.some(e => e.id === exercise.id)
                ? list.map(e => (e.id === exercise.id ? exercise : e))
                : [...list, exercise],
        );
        close();
    };

    const removeExercise = (id: string) => {
        animateLayout();
        setExercises(list => list.filter(e => e.id !== id));
        close();
    };

    const move = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= exercises.length) {
            return;
        }
        haptics.tap();
        animateLayout();
        setExercises(list => {
            const next = [...list];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const save = async () => {
        if (problem) {
            return;
        }
        const workout: Workout = { id: existing?.id ?? newId('w'), name: trimmed, exercises };
        if (await saveWorkout(workout)) {
            haptics.success();
            navigation.goBack();
        } else {
            setDialog({ kind: 'error' });
        }
    };

    const confirmDelete = async () => {
        close();
        if (existing && (await deleteWorkout(existing.id))) {
            navigation.goBack();
        } else {
            setDialog({ kind: 'error' });
        }
    };

    return (
        <BaseScreen
            title={existing ? 'Edit workout' : 'New workout'}
            subtitle={exercises.length ? describeWorkout({ id: '', name, exercises }) : 'Exercises, sets and rest'}
            headerLeft={<BackButton />}
            headerRight={
                existing ? (
                    <IconButton
                        icon="Trash"
                        variant="outline"
                        accessibilityLabel="Delete workout"
                        onPress={() => setDialog({ kind: 'delete' })}
                    />
                ) : undefined
            }>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <SectionHeader title="Name" />
                <TextField value={name} onChangeText={setName} placeholder="e.g. Upper body" maxLength={MAX_NAME} />

                <SectionHeader title="Exercises" />
                {exercises.map((exercise, index) => (
                    <Card key={exercise.id} onPress={() => setDialog({ kind: 'exercise', exercise, isNew: false })}>
                        <View style={styles.exerciseRow}>
                            <ThemedText weight="strong" color="muted" tabular style={styles.index}>
                                {index + 1}
                            </ThemedText>
                            <View style={styles.flex}>
                                <ThemedText weight="medium">{exercise.name}</ThemedText>
                                <ThemedText size="small" color="muted" tabular>
                                    {describeExercise(exercise)}
                                </ThemedText>
                            </View>
                            <IconButton
                                icon="Up"
                                size={32}
                                accessibilityLabel={`Move ${exercise.name} up`}
                                onPress={() => move(index, -1)}
                                tint={index === 0 ? theme.colors.border : theme.colors.muted}
                            />
                            <IconButton
                                icon="Down"
                                size={32}
                                accessibilityLabel={`Move ${exercise.name} down`}
                                onPress={() => move(index, 1)}
                                tint={index === exercises.length - 1 ? theme.colors.border : theme.colors.muted}
                            />
                        </View>
                    </Card>
                ))}
                {exercises.length < MAX_EXERCISES && (
                    <Button
                        label="Add exercise"
                        icon="Plus"
                        iconLeading
                        variant="secondary"
                        onPress={() => setDialog({ kind: 'exercise', exercise: newExercise(), isNew: true })}
                        style={styles.add}
                    />
                )}

                {problem && (trimmed.length > 0 || exercises.length > 0) && (
                    <ThemedText size="small" color="primaryRed" style={styles.problem}>
                        {problem}
                    </ThemedText>
                )}
                <Button
                    label={existing ? 'Save changes' : 'Create workout'}
                    disabled={!!problem}
                    onPress={save}
                    style={styles.save}
                />
            </ScrollView>

            <ExerciseDialog
                exercise={dialog?.kind === 'exercise' ? dialog.exercise : null}
                isNew={dialog?.kind === 'exercise' && dialog.isNew}
                onClose={close}
                onSave={putExercise}
                onDelete={removeExercise}
            />
            <Dialog
                visible={dialog?.kind === 'delete'}
                onClose={close}
                icon="Trash"
                tone="danger"
                title={`Delete “${existing?.name ?? ''}”?`}
                message="Your workout history stays; only the plan is removed."
                actions={confirmActions(close, 'Delete', confirmDelete, true)}
            />
            <ErrorPopup {...ERRORS.saveFailed} visible={dialog?.kind === 'error'} onClose={close} />
        </BaseScreen>
    );
};

/** Add or edit one exercise: name, reps or time, sets and rest. */
const ExerciseDialog: React.FC<{
    exercise: Exercise | null;
    isNew: boolean;
    onClose: () => void;
    onSave: (exercise: Exercise) => void;
    onDelete: (id: string) => void;
}> = ({ exercise, isNew, onClose, onSave, onDelete }) => {
    const [draft, setDraft] = useState<Exercise | null>(exercise);

    // Fresh copy every time the dialog opens.
    useEffect(() => {
        if (exercise) {
            setDraft(exercise);
        }
    }, [exercise]);

    const change = (patch: Partial<Exercise>) => setDraft(d => (d ? { ...d, ...patch } : d));
    const valid = !!draft && draft.name.trim().length > 0;

    const actions = [
        ...(!isNew && draft
            ? [{ label: 'Remove', variant: 'danger' as const, onPress: () => onDelete(draft.id) }]
            : []),
        { label: 'Cancel', variant: 'secondary' as const, onPress: onClose },
        {
            label: isNew ? 'Add' : 'Save',
            onPress: () => (valid && draft ? onSave({ ...draft, name: draft.name.trim() }) : undefined),
        },
    ];

    return (
        <Dialog
            visible={!!exercise}
            onClose={onClose}
            title={isNew ? 'Add exercise' : 'Edit exercise'}
            actions={actions}>
            {draft && (
                <View>
                    <TextField
                        value={draft.name}
                        onChangeText={text => change({ name: text })}
                        placeholder="e.g. Push-ups"
                        maxLength={MAX_NAME}
                        autoFocus={isNew}
                        inset={false}
                        surface="background"
                    />
                    <Segmented
                        options={MODES}
                        value={draft.mode}
                        onChange={mode => change({ mode })}
                        style={styles.modes}
                    />
                    <Field label="Sets">
                        <Stepper
                            value={draft.sets}
                            onChange={sets => change({ sets })}
                            {...LIMITS.sets}
                            accessibilityLabel="sets"
                            compact
                        />
                    </Field>
                    {draft.mode === 'reps' ? (
                        <Field label="Reps per set">
                            <Stepper
                                value={draft.reps}
                                onChange={reps => change({ reps })}
                                {...LIMITS.reps}
                                accessibilityLabel="reps"
                                compact
                            />
                        </Field>
                    ) : (
                        <Field label="Time per set">
                            <Stepper
                                value={draft.seconds}
                                onChange={seconds => change({ seconds })}
                                {...LIMITS.seconds}
                                format={formatSeconds}
                                accessibilityLabel="time per set"
                                compact
                            />
                        </Field>
                    )}
                    <Field label="Rest after each set">
                        <Stepper
                            value={draft.rest}
                            onChange={rest => change({ rest })}
                            {...LIMITS.rest}
                            format={v => (v ? formatSeconds(v) : 'None')}
                            accessibilityLabel="rest"
                            compact
                        />
                    </Field>
                </View>
            )}
        </Dialog>
    );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <View style={styles.field}>
        <ThemedText size="small" color="muted" style={styles.flex}>
            {label}
        </ThemedText>
        {children}
    </View>
);

const styles = StyleSheet.create({
    scroll: {
        paddingBottom: spacing.xl,
    },
    flex: {
        flex: 1,
    },
    exerciseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    index: {
        width: 22,
    },
    add: {
        marginHorizontal: gutter,
        marginTop: spacing.md,
    },
    modes: {
        marginTop: spacing.md,
    },
    field: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
    },
    problem: {
        marginTop: spacing.lg,
        marginHorizontal: gutter + 2,
    },
    save: {
        marginHorizontal: gutter,
        marginTop: spacing.lg,
    },
});

export default WorkoutEditorScreen;
