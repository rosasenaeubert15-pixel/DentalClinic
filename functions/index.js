import * as functions from "firebase-functions";
import axios from "axios";

export const sendSMSOnAppointment = functions.firestore
  .document('appointments/{appointmentId}')
  .onCreate(async (snap) => {
    const data = snap.data();

    const phone = data.phone  data.contactNumber;
    const name = data.name  "Patient";

    if (!phone) return console.log("❌
 No phone number in appointment");

    const message =
      Hi ${name}, your appointment has been created and is pending confirmation. Thank you! - Dentavis;

    try {
      const response = await axios.post(
        "https://api.semaphore.co/api/v4/messages",
        { number: phone, message }
      );

      console.log("📩
 SMS sent:", response.data);
    } catch (error) {
      console.error("❌
 SMS failed:", error.response?.data || error.message);
    }
  });