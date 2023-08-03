// app.js (or your main Node.js server file)

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { isAddress } = require("ethers");
const { json, urlencoded } = require("express");
const Distribute = require("./distribute");

/**
 * Initialize Express Application
 */
const app = express();


/** Express Middleware */
app.use(json());
app.use(urlencoded());
app.use(cors());
app.use(helmet());

let queue;

// Function to initialize the queue
async function initializeQueue() {
  const module = await import('p-queue');
  queue = new module.default({ concurrency: 1, intervalCap: 1, interval: 10000});
}

initializeQueue();


app.get("/", (_, res) => {
  return res.status(200).send("API Distributor Healthy");
});

app.get("/claim/:address", async (req, res) => {
	const { address } = req.params;
  
	if (!isAddress(address)) return res.status(400).send("Invalid Ethereum Address");
  
	try {
	  // Queue the request to be processed one at a time with retries
	  const distribute = await queue.add(async () => {
		console.log("Gas Request Added To Queue...");
		let retryCount = 0;
		let distributeResponse;
  
		while (retryCount < 3) {
		  try {
			distributeResponse = await Distribute({ address });
			if (distributeResponse.success) {
			  // Request succeeded, break out of the retry loop
			  break;
			} else {
			  // Request failed, increment retry count and try again
			  retryCount++;
			  console.warn(`Gas distribution failed. Retrying (${retryCount}/3)...`);
			}
		  } catch (err) {
			// Request failed due to an error, increment retry count and try again
			retryCount++;
			console.warn(`Gas distribution error. Retrying (${retryCount}/3)...`);
			console.error(err);
		  }
		}
  
		if (retryCount >= 3 && !distributeResponse.success) {
		  // If the request still fails after 3 retries, return failure response
		  return {
			success: false,
			message: "Gas distribution failed after maximum retries.",
		  };
		}
  
		return distributeResponse; // Return the response from the successful request
	  });
  
	  console.log("Response from Distribute:", distribute); // Log the final response data
  
	  return res.status(200).send({
		success: distribute.success,
		message: distribute.message,
		data: distribute.data, // Include any relevant data from the response
	  });
	} catch (err) {
	  console.error("Error processing the request:", err);
	  return res.status(500).send("Internal server error.");
	}
  });

app.listen(8888, () => {
  console.log("SKALE API Distributor Listening on ", 8888);
});
