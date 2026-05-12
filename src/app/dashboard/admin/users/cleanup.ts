import { db } from '@/lib/firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

export async function cleanupAdmins(currentAdminUid: string) {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const adminsToDelete = usersSnap.docs.filter(d => 
      d.data().role === 'admin' && d.id !== currentAdminUid
    );

    console.log(`Found ${adminsToDelete.length} admins to delete.`);

    for (const adminDoc of adminsToDelete) {
      await deleteDoc(doc(db, 'users', adminDoc.id));
      console.log(`Deleted admin: ${adminDoc.data().name} (${adminDoc.id})`);
    }

    return adminsToDelete.length;
  } catch (error) {
    console.error("Cleanup failed:", error);
    throw error;
  }
}
