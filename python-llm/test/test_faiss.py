import numpy as np
import faiss

print("FAISS version:", faiss.__version__)

dimension = 384
index = faiss.IndexFlatL2(dimension)
print(index.ntotal)

index = faiss.IndexFlatL2(dimension)
vectors = np.random.random((5, dimension)).astype("float32")
index.add(vectors)
print(index.ntotal)


query = np.random.random((1, dimension)).astype("float32")
distances, indices = index.search(query, 3)
print(indices)
print(distances)