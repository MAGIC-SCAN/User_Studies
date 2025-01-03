import {
  createSlice, configureStore, type PayloadAction, createSelector,
} from '@reduxjs/toolkit';
import { createContext, useContext } from 'react';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { ResponseBlockLocation, StudyConfig, StringOption } from '../parser/types';
import {
  StoredAnswer, TrialValidation, TrrackedProvenance, StoreState, Sequence, ParticipantMetadata,
} from './types';
import { getSequenceFlatMap } from '../utils/getSequenceFlatMap';
import { REVISIT_MODE } from '../storage/engines/StorageEngine';

export async function studyStoreCreator(
  studyId: string,
  config: StudyConfig,
  sequence: Sequence,
  metadata: ParticipantMetadata,
  answers: Record<string, StoredAnswer>,
  modes: Record<REVISIT_MODE, boolean>,
) {
  const flatSequence = getSequenceFlatMap(sequence);

  const emptyAnswers: Record<string, StoredAnswer> = Object.fromEntries(flatSequence.filter((id) => id !== 'end')
    .map((id, idx) => [
      `${id}_${idx}`,
      {
        answer: {}, startTime: 0, endTime: -1, provenanceGraph: undefined, windowEvents: [], timedOut: false,
      },
    ]));
  const emptyValidation: TrialValidation = Object.assign(
    {},
    ...flatSequence.map((id, idx) => ({ [`${id}_${idx}`]: { aboveStimulus: { valid: false, values: {} }, belowStimulus: { valid: false, values: {} }, sidebar: { valid: false, values: {} } } })),
  );
  const allValid = Object.assign(
    {},
    ...flatSequence.map((id, idx) => ({
      [`${id}_${idx}`]: {
        aboveStimulus: true, belowStimulus: true, sidebar: true, values: {},
      },
    })),
  );

  const initialState: StoreState = {
    studyId,
    isRecording: false,
    answers: Object.keys(answers).length > 0 ? answers : emptyAnswers,
    sequence,
    config,
    showStudyBrowser: true,
    showHelpText: false,
    alertModal: { show: false, message: '' },
    trialValidation: answers ? allValid : emptyValidation,
    iframeAnswers: {},
    iframeProvenance: null,
    metadata,
    modes,
    matrixAnswers: {},
  };

  const storeSlice = createSlice({
    name: 'storeSlice',
    initialState,
    reducers: {
      setConfig(state, payload: PayloadAction<StudyConfig>) {
        state.config = payload.payload;
      },
      setIsRecording(state, payload: PayloadAction<boolean>) {
        state.isRecording = payload.payload;
      },
      toggleStudyBrowser: (state) => {
        state.showStudyBrowser = !state.showStudyBrowser;
      },
      toggleShowHelpText: (state) => {
        state.showHelpText = !state.showHelpText;
      },
      setAlertModal: (state, action: PayloadAction<{ show: boolean; message: string }>) => {
        state.alertModal = action.payload;
      },
      setIframeAnswers: (state, action: PayloadAction<Record<string, unknown>>) => {
        state.iframeAnswers = action.payload;
      },
      setIframeProvenance: (state, action: PayloadAction<TrrackedProvenance | null>) => {
        state.iframeProvenance = action.payload;
      },
      setMatrixAnswersRadio: (state, action: PayloadAction<{ questionKey: string, responseId: string, val: string }>) => {
        const { responseId, questionKey, val } = action.payload;

        // Set state
        state.matrixAnswers = {
          ...state.matrixAnswers,
          [responseId]: {
            ...state.matrixAnswers[responseId],
            [questionKey]: val,
          },
        };
      },
      setMatrixAnswersCheckbox: (state, action: PayloadAction<{ questionKey: string, responseId: string, value: string, label: string, isChecked: boolean, choiceOptions: StringOption[] }>) => {
        const {
          responseId, questionKey, value, isChecked, choiceOptions,
        } = action.payload;

        const currentAnswer = state.matrixAnswers[responseId]?.[questionKey] ?? '';
        let newAnswer = '';
        if (isChecked) {
          if (currentAnswer.length > 0) {
            newAnswer = [...currentAnswer.split('|'), value].sort((a, b) => choiceOptions.map((entry) => entry.value).indexOf(a) - choiceOptions.map((entry) => entry.value).indexOf(b))
              .join('|');
          } else {
            newAnswer = `${value}`;
          }
        } else {
          newAnswer = currentAnswer.split('|').filter((entry) => entry !== value).join('|');
        }

        // Set state
        state.matrixAnswers = {
          ...state.matrixAnswers,
          [responseId]: {
            ...state.matrixAnswers[responseId],
            [questionKey]: newAnswer,
          },
        };
      },
      updateResponseBlockValidation: (
        state,
        {
          payload,
        }: PayloadAction<{
          location: ResponseBlockLocation;
          identifier: string;
          status: boolean;
          values: object;
          provenanceGraph?: TrrackedProvenance;
        }>,
      ) => {
        if (!state.trialValidation[payload.identifier]) {
          state.trialValidation[payload.identifier] = {
            aboveStimulus: { valid: false, values: {} },
            belowStimulus: { valid: false, values: {} },
            sidebar: { valid: false, values: {} },
            provenanceGraph: undefined,
          };
        }
        state.trialValidation[payload.identifier][payload.location] = { valid: payload.status, values: payload.values };

        if (payload.provenanceGraph) {
          state.trialValidation[payload.identifier].provenanceGraph = payload.provenanceGraph;
        }
      },
      saveTrialAnswer(
        state,
        {
          payload,
        }: PayloadAction<{ identifier: string } & StoredAnswer>,
      ) {
        const {
          identifier, answer, startTime, endTime, provenanceGraph, windowEvents, timedOut,
        } = payload;
        state.answers[identifier] = {
          answer,
          startTime,
          endTime,
          provenanceGraph,
          windowEvents,
          timedOut,
        };
      },
    },
  });

  const store = configureStore(
    {
      reducer: storeSlice.reducer,
      preloadedState: initialState,
    },
  );

  return { store, actions: storeSlice.actions };
}

export type StudyStore = Awaited<ReturnType<typeof studyStoreCreator>>;

export const StudyStoreContext = createContext<StudyStore>(null!);

export function useStoreActions() {
  return useContext(StudyStoreContext).actions;
}

// Hooks
type StoreDispatch = StudyStore['store']['dispatch'];

export const useStoreDispatch: () => StoreDispatch = useDispatch;
export const useStoreSelector: TypedUseSelectorHook<StoreState> = useSelector;

export function useAreResponsesValid(id: string) {
  return useStoreSelector((state) => {
    if (id.includes('reviewer-')) {
      return true;
    }
    const valid = Object.values(state.trialValidation[id]).every((x) => {
      if (typeof x === 'object' && 'valid' in x) {
        return x.valid;
      }
      return true;
    });
    if (!valid) return false;

    // Valid seems to not be an object, just a boolean (you're using 'every').
    // Was this originally something else? Should just be "return valid"
    // instead of "if (!valid) return false" and then the stuff below
    return Object.values(valid).every((x) => x);
  });
}

const flatSequenceSelector = createSelector(
  (state) => state.sequence,
  (sequence) => getSequenceFlatMap(sequence),
);

export function useFlatSequence() {
  return useStoreSelector(flatSequenceSelector);
}
