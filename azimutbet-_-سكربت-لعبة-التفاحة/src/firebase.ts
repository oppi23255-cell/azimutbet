import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, type Unsubscribe } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyCC5-CsnGY5sMXzpNnnTPvDwdFu8aHX8cQ',
  authDomain: 'ziko-5fa27.firebaseapp.com',
  databaseURL: 'https://ziko-5fa27-default-rtdb.firebaseio.com',
  projectId: 'ziko-5fa27',
  storageBucket: 'ziko-5fa27.firebasestorage.app',
  messagingSenderId: '177756561652',
  appId: '1:177756561652:web:547eff48265a1ec4393ea1',
  measurementId: 'G-XMFNR6TK9L',
};

const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);

export type PredictionsMap = Record<string, Record<string, string>>;

export const ROW_MULTIPLIERS = [
  'x1.23',
  'x1.54',
  'x1.93',
  'x2.41',
  'x4.02',
  'x6.71',
  'x11.18',
  'x27.92',
  'x69.93',
  'x349.68',
];

export const generatePredictions = async (): Promise<PredictionsMap> => {
  const finalObject: PredictionsMap = {};

  for (let r = 0; r < 10; r++) {
    let safeCount = 4;
    if (r >= 4 && r < 7) safeCount = 3;
    if (r >= 7 && r < 9) safeCount = 2;
    if (r >= 9) safeCount = 1;

    const safeCols: number[] = [];
    while (safeCols.length < safeCount) {
      const randomCol = Math.floor(Math.random() * 5);
      if (!safeCols.includes(randomCol)) {
        safeCols.push(randomCol);
      }
    }

    for (let c = 0; c < 5; c++) {
      const mIndex = r * 5 + c + 1;
      const mKey = `m${mIndex}`;
      const value = safeCols.includes(c) ? '1' : '0';
      finalObject[mKey] = { [mKey]: value };
    }
  }

  const rRef = ref(rtdb, 'm11');
  await set(rRef, finalObject);
  return finalObject;
};

export const fetchPredictionsOnce = async (): Promise<PredictionsMap | null> => {
  const rRef = ref(rtdb, 'm11');
  const snapshot = await get(rRef);
  if (snapshot.exists()) {
    return snapshot.val() as PredictionsMap;
  }
  return null;
};

export const subscribePredictions = (
  callback: (data: PredictionsMap | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  const rRef = ref(rtdb, 'm11');
  return onValue(
    rRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val() as PredictionsMap);
      } else {
        callback(null);
      }
    },
    (error) => {
      if (onError) onError(error);
    },
  );
};

export const isSafeApple = (
  predictions: PredictionsMap | null,
  rowIdx: number,
  colIdx: number,
): boolean => {
  if (!predictions || Object.keys(predictions).length === 0) return false;
  const mIndex = rowIdx * 5 + colIdx + 1;
  const mKey = `m${mIndex}`;
  const mObj = predictions[mKey];
  if (mObj && typeof mObj === 'object' && mObj[mKey] === '1') {
    return true;
  }
  return false;
};
