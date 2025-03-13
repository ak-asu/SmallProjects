import { useRouter } from "expo-router";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList
} from "react-native";

import styles from "./popularjobs.style";

const Popularjobs = () => {
  const router = useRouter();

  // Sample job listings
  const recentJobs = [
    { id: "1", title: "Software Engineer", company: "Google" },
    { id: "2", title: "Full Stack Engineer", company: "Meta" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recent jobs</Text>
        <TouchableOpacity>
          <Text style={styles.headerBtn}>Show all</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.listContainer}>
      <FlatList
        data={recentJobs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.jobCard}>
            <Text style={styles.jobTitle}>{item.title}</Text>
            <Text style={styles.jobCompany}>{item.company}</Text>
          </TouchableOpacity>
        )}
      />
      </View>
    </View>
  );
};

export default Popularjobs;
