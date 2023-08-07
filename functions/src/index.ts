import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {DocumentData} from "firebase-admin/firestore";

admin.initializeApp();

export const getAllSongs = functions.https.onRequest((request, response) => {
  const userId:string = request.query.userId === undefined ?
    "" : request.query.userId.toString();

  if (userId === "") {
    response.status(500).send("userId undefined");
  } else {
    admin.firestore().collection("Music").get()
      .then(async (result) => {
        const songs = await convertSongs(result.docs, userId);

        // response.send({status: 200, data: {songs: songs}});
        response.send({status: 200, data: songs});
      })
      .catch((error) => {
        console.log(error);
        response.status(500).send(error);
      });
  }
});

export const search = functions.https.onRequest((request, response) => {
  const subject:string = request.query.subject === undefined ?
    "" : request.query.subject.toString();
  const userId:string = request.query.userId === undefined ?
    "" : request.query.userId.toString();

  if (userId === "") {
    response.status(500).send("userId undefined");
  } else if (subject === "") {
    response.status(500).send("subject undefined");
  } else {
    let songs: DocumentData;
    let artists: DocumentData;
    let collections: DocumentData;

    searchSubject("Music", subject).then(async (res) => {
      songs = await convertSongs(res, userId);
    }).then(() => {
      searchSubject("Artists", subject).then((res) => {
        artists = convertArtists(res);
      }).then(() => {
        searchSubject("Collection", subject).then((res) => {
          collections = convertCollections(res);

          response.send({
            status: 200,
            data: {songs: songs, artists: artists,
              collections: collections},
          });
        });
      });
    });
  }
});

export const getSongsByCollectionId =
  functions.https.onRequest((request, response) => {
    const collection:string = request.query.collection === undefined ?
      "" : request.query.collection.toString();
    const userId:string = request.query.userId === undefined ?
      "" : request.query.userId.toString();

    if (userId === "") {
      response.status(500).send("userId undefined");
    } else if (collection === "") {
      response.status(500).send("collection undefined");
    } else {
      admin.firestore().collection("Music")
        .where("CollectionId", "==", collection).get()
        .then(async (result) => {
          const songs = await convertSongs(result.docs, userId);

          // response.send({status: 200, data: {songs: songs}});
          response.send({status: 200, data: songs});
        })
        .catch((error) => {
          console.log(error);
          response.status(500).send(error);
        });
    }
  });

export const getArtistById = functions.https.onRequest((request, response) => {
  const id:string = request.query.id === undefined ?
    "" : request.query.id.toString();
  const userId:string = request.query.userId === undefined ?
    "" : request.query.userId.toString();

  if (userId === "") {
    response.status(500).send("userId undefined");
  } else if (id === "") {
    response.status(500).send("artist id undefined");
  } else {
    admin.firestore().collection("Artists").doc(id).get()
      .then(async (result) => {
        const artist = convertArtist(result);

        // response.send({status: 200, data: {songs: songs}});
        return artist;
      }).then((artist) => {
        admin.firestore().collection("Collection")
          .where("ArtistId", "==", id).get().then(async (res) => {
            const collections = await getSongsByCollections(res.docs, userId);
            const artistData = {artist: artist, collections: collections};
            response.send({status: 200, data: artistData});
          });
      })
      .catch((error) => {
        console.log(error);
        response.status(500).send(error);
      });
  }
});

export const heartSong = functions.https.onRequest((request, response) => {
  const userId:string = request.query.userId === undefined ?
    "" : request.query.userId.toString();
  const songId:string = request.query.songId === undefined ?
    "" : request.query.songId.toString();

  if (userId === "" && songId === "") {
    response.status(500).send("userId and songId undefined");
  } else if (userId === "") {
    response.status(500).send("userId undefined");
  } else if (songId === "") {
    response.status(500).send("songId undefined");
  } else {
    admin.firestore().collection("FavSongs")
      .add({UserId: userId, SongId: songId})
      .then(() => {
        response.send({status: 200, data: true});
      })
      .catch((error) => {
        console.log(error);
        response.status(500).send(error);
      });
  }
});

export const unheartSong = functions.https.onRequest((request, response) => {
  const id:string = request.query.id === undefined ?
    "" : request.query.id.toString();

  if (id === "") {
    response.status(500).send("id undefined");
  } else {
    admin.firestore().collection("FavSongs")
      .doc(id).delete()
      .then(() => {
        response.send({status: 200, data: true});
      })
      .catch((error) => {
        console.log(error);
        response.status(500).send(error);
      });
  }
});

export const getSongsByArtist =
  functions.https.onRequest((request, response) => {
    const id:string = request.query.id === undefined ?
      "" : request.query.id.toString();
    const userId:string = request.query.userId === undefined ?
      "" : request.query.userId.toString();

    if (userId === "") {
      response.status(500).send("userId undefined");
    } else if (id === "") {
      response.status(500).send("artist id undefined");
    } else {
      admin.firestore().collection("Music")
        .where("ArtistId", "==", id).get().then(async (result) => {
          const songs = await convertSongs(result.docs, userId);

          response.send({status: 200, data: songs});
        })
        .catch((error) => {
          console.log(error);
          response.status(500).send(error);
        });
    }
  });

export const getHeartedSongs =
  functions.https.onRequest((request, response) => {
    const userId:string = request.query.userId === undefined ?
      "" : request.query.userId.toString();

    if (userId === "") {
      response.status(500).send("userId undefined");
    } else {
      admin.firestore().collection("FavSongs")
        .where("UserId", "==", userId).get().then(async (result) => {
          const songs = await getSongsByFavSongs(result.docs, userId);

          response.send({status: 200, data: songs});
        })
        .catch((error) => {
          console.log(error);
          response.status(500).send(error);
        });
    }
  });

export const convertSongs = (async (docs: DocumentData[], userId:string) => {
  const songs:unknown[] = [];
  for (const doc of docs) {
    songs.push(await convertSong(doc, userId));
  }
  return songs;
});

export const convertSong = (async (doc:DocumentData, userId:string) => {
  const id = doc.id;
  const collection = doc.get("CollectionId");
  // const artistRef = doc.get("Artist");
  // const artist = artistRef.path === undefined ? undefined :
  //  artistRef.path.split("/")[1];
  const artist = doc.get("ArtistId");
  const artistName = doc.get("ArtistName");
  // await getArtistByReference(artistRef);
  const name = doc.get("Name");
  const length = doc.get("Length");
  const path = doc.get("FilePath");
  const imagePath = doc.get("ImagePath");
  const fav = await checkFavSong(userId, id);

  return {id: id, collection: collection, artist: artist,
    artistName: artistName === undefined ? "undefined" : artistName,
    name: name, length: length, path: path, imagePath: imagePath, fav: fav};
});

/* export const getArtistByReference = async
(artistDocRef: DocumentReference) => {
  const result = await artistDocRef.get();
  return result.data();
}; */

export const searchSubject = async (search: string, subject:string) =>{
  const searchResults:DocumentData[] = [];

  const res = await admin.firestore()
    .collection(search).get();

  for (const doc of res.docs) {
    const name:string = doc.get("Name");
    if (name !== undefined) {
      if (name.toLowerCase().includes(subject.toLowerCase(), 0)) {
        searchResults.push(doc);
      }
    }
  }

  return searchResults;
};

export const convertArtists = ((docs: DocumentData[]) => {
  const songs:unknown[] = [];
  for (const doc of docs) {
    songs.push(convertArtist(doc));
  }
  return songs;
});

export const convertArtist = ((doc:DocumentData) => {
  const id = doc.id;
  const name = doc.get("Name");
  const description = doc.get("Description");
  const imagePath = doc.get("ImagePath");

  return {id: id, name: name, description: description, imagePath: imagePath};
});

export const convertCollections = ((docs: DocumentData[]) => {
  const songs:unknown[] = [];
  for (const doc of docs) {
    songs.push(convertCollection(doc));
  }
  return songs;
});

export const convertCollection = ((doc:DocumentData) => {
  const id = doc.id;
  const artist = doc.get("Artist").path ===
    undefined ? undefined : doc.get("Artist")
      .path.split("/")[1];
  const artistName = doc.get("ArtistName");
  const imagePath = doc.get("ImagePath");
  const name = doc.get("Name");
  const type = doc.get("Type");

  return {id: id, name: name, artist: artist, artistName: artistName,
    imagePath: imagePath, type: type};
});

export const getSongsByCollections =
  (async (docs: DocumentData[], userId:string) => {
    const songsByCollection:unknown[] = [];
    for (const doc of docs) {
      const collectionId = doc.id;
      if (collectionId !== undefined) {
        const songObjs =
          await getSongsByCollection(collectionId, userId);
        const colObj = await convertCollection(doc);
        songsByCollection.push({collection: colObj, songs: songObjs});
      }
    }
    return songsByCollection;
  });

export const getSongsByCollection =
  (async (collectionId:number, userId:string) => {
    const res = await admin.firestore().collection("Music")
      .where("CollectionId", "==", collectionId).get();

    const songObjs:unknown[] = [];

    for (const doc of res.docs) {
      songObjs.push(await convertSong(doc, userId));
    }

    return songObjs;
  });

export const checkFavSong = async (userId:string, songId:string) => {
  const res = await admin.firestore().collection("FavSongs")
    .where("UserId", "==", userId)
    .where("SongId", "==", songId).get();

  for (const doc of res.docs) {
    return doc.id;
  }

  return "";
};

export const getSongsByFavSongs =
  async (docs: DocumentData[], userId: string) => {
    const songs: unknown[] = [];

    for (const doc of docs) {
      const song = await getSongById(doc.get("SongId"));
      const songObj = await convertSong(song, userId);
      songs.push(songObj);
    }

    return songs;
  };

export const getSongById =
  async (songId: string) => {
    const res = await admin.firestore().collection("Music")
      .doc(songId).get();

    return res;
  };
