// BTL Storage Helper for Time Table & Dashboard Persistence

export const getStoredTimeTable = (dateKey) => {
  try {
    const data = localStorage.getItem(`btl_timetable_${dateKey}`);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Error reading timetable:', e);
    return null;
  }
};

export const saveStoredTimeTable = (dateKey, items) => {
  try {
    localStorage.setItem(`btl_timetable_${dateKey}`, JSON.stringify(items));
    return true;
  } catch (e) {
    console.error('Error saving timetable:', e);
    return false;
  }
};
