// App.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Image,
  StyleSheet,
  ScrollView,
  FlatList,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { chatWithGeminiMultiModal } from "./GeminiMultiModalService";

export default function App() {
  const [image, setImage] = useState(null);
  const [description, setDescription] = useState("");
  const [parsedResult, setParsedResult] = useState(null);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      const resizedImage = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      setImage(resizedImage.uri);
    }
  };

  const analyzeImage = async () => {
    if (!image || !description) {
      alert("Please select an image and provide a description.");
      return;
    }

    try {
      const base64Image = await convertToBase64(image);

      const prompt = `You are a helpful AI assisting with analyzing a restaurant bill image. The user provides a description of how they want to split the bill, and you should return the total amount owed by each person in a structured JSON format. The response should be like this:
      {
        "total_amount": 0,
        "people": [
          {
            "name": "Person A",
            "amount": 0
          },
          ...
        ]
      }`;

      const geminiResponse = await chatWithGeminiMultiModal(
        prompt,
        description,
        base64Image
      );

      // Parse strings into numbers
      if (geminiResponse) {
        geminiResponse.total_amount = parseFloat(geminiResponse.total_amount);
        geminiResponse.people = geminiResponse.people.map((person) => ({
          ...person,
          amount: parseFloat(person.amount),
        }));
      }

      setParsedResult(geminiResponse);
    } catch (error) {
      console.error("Error analyzing image:", error);
      setParsedResult({ error: "Error analyzing image. Please try again." });
    }
  };

  const convertToBase64 = async (uri) => {
    const response = await fetch(uri);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result.split(",")[1];
        resolve(base64data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const renderResult = () => {
    if (!parsedResult) return null;

    if (parsedResult.error) {
      return <Text style={styles.errorText}>{parsedResult.error}</Text>;
    }

    return (
      <View style={styles.parsedResultContainer}>
        <Text style={styles.totalAmountText}>
          Total Amount: ${parsedResult.total_amount.toFixed(2)}
        </Text>
        <Text style={styles.heading}>Bill Split Details:</Text>
        <FlatList
          data={parsedResult.people}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <View style={styles.personContainer}>
              <Text style={styles.personName}>{item.name}</Text>
              <Text style={styles.personAmount}>
                Amount Owed: ${item.amount.toFixed(2)}
              </Text>
            </View>
          )}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Button
        title="Pick an Image"
        style={styles.pickImage}
        onPress={pickImage}
        color="#1e90ff"
      />
      {image && <Image source={{ uri: image }} style={styles.image} />}
      <TextInput
        style={styles.input}
        placeholder="Enter bill split description"
        placeholderTextColor="#aaa"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Button title="Analyze Bill" onPress={analyzeImage} color="#1e90ff" />
      <ScrollView style={styles.resultContainer}>{renderResult()}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  image: {
    width: 200,
    height: 200,
    marginVertical: 20,
    borderRadius: 10,
  },
  pickImage: { padddingTop: 30 },
  input: {
    width: "100%",
    height: 100,
    borderColor: "#444",
    borderWidth: 1,
    marginBottom: 20,
    padding: 10,
    color: "#fff",
    backgroundColor: "#222",
    borderRadius:8
  },
  resultContainer: {
    marginTop: 20,
    maxHeight: 400,
    width: "100%",
    backgroundColor: "#333",
    padding: 10,
    borderRadius: 10,
  },
  parsedResultContainer: {
    padding: 10,
  },
  totalAmountText: {
    fontSize: 18,
    color: "#1e90ff",
    fontWeight: "bold",
    marginBottom: 10,
  },
  heading: {
    fontSize: 16,
    color: "#fff",
    marginBottom: 5,
  },
  personContainer: {
    backgroundColor: "#222",
    padding: 10,
    marginVertical: 5,
    borderRadius: 5,
  },
  personName: {
    color: "#1e90ff",
    fontSize: 16,
    fontWeight: "bold",
  },
  personAmount: {
    color: "#fff",
    fontSize: 14,
  },
  errorText: {
    color: "red",
    textAlign: "center",
  },
});
