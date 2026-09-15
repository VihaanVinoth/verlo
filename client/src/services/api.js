const API_BASE_URL = import.meta.env.PROD 
  ? 'https://verlo-30xs.onrender.com' 
  : 'http://127.0.0.1:5001';

export async function submitProblem(formData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/diagnose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Server returned an error response');
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}