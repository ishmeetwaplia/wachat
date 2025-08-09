// server/utils/helpers.js

/**
 * Chunks an array into smaller arrays of a specified size.
 * @param {Array} array - The array to chunk.
 * @param {number} size - The size of each chunk.
 * @returns {Array<Array>} An array of chunks.
 */
exports.chunkArray = (array, size) => {
    const chunkedArr = [];
    let index = 0;
    while (index < array.length) {
        chunkedArr.push(array.slice(index, index + size));
        index += size;
    }
    return chunkedArr;
};

/**
 * Builds a WhatsApp template message payload dynamically.
 * Assumes `baseMessage` contains `name` and `language.code`.
 * `contact` object is used to extract variables (e.g., name, and other custom fields).
 * `components` is the template's components array as stored in your DB (or sent from frontend).
 * It will dynamically fill placeholders like {{field_name}} in text parameters from the contact object.
 * It also strips the unexpected 'format' key from individual parameters.
 *
 * @param {Object} baseMessage - Base template message (name, language).
 * @param {Object} contact - The contact object with data to fill parameters.
 * @param {Array} components - The template components array (from your Template model or request body).
 * @returns {Object} The formatted template message payload for WhatsApp API.
 */
exports.buildTemplateMessage = (baseMessage, contact, components) => {
    // Deep copy to avoid modifying the original components array from the template/request body
    const newComponents = JSON.parse(JSON.stringify(components || [])); // Ensure it's an array, even if null/undefined

    newComponents.forEach(component => {
        // Handle parameters within each component
        if (component.parameters) {
            component.parameters = component.parameters.map(param => {
                const newParam = { ...param }; // Create a shallow copy of the parameter object

                // --- CRITICAL FIX: Remove 'format' key from individual parameters ---
                // Meta API does NOT expect 'format' on individual parameters within the 'parameters' array.
                // It only expects it on the component level for HEADER.
                if (newParam.format !== undefined) {
                    delete newParam.format;
                }
                // -------------------------------------------------------------------

                // Process 'text' type parameters for dynamic placeholder replacement
                if (newParam.type === 'text' && newParam.text) {
                    let replacedText = String(newParam.text); // Ensure it's a string

                    // Replace placeholders like {{field_name}} with values from the contact object
                    for (const key in contact) {
                        // Check if contact has the property and it's not null/undefined
                        if (contact.hasOwnProperty(key) && contact[key] !== null && contact[key] !== undefined) {
                            const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g'); // Regex for {{key}}
                            replacedText = replacedText.replace(placeholder, String(contact[key])); // Convert contact value to string
                        }
                    }
                    newParam.text = replacedText;
                }
                // For 'image', 'video', 'document' parameters, ensure they have 'link' or 'id'
                // and structure is correct (e.g., { "type": "image", "image": { "link": "..." }})
                // The current structure seems to handle this at the `sendWhatsAppMessage` level.

                return newParam;
            });
        }
    });

    return {
        name: baseMessage.name,
        language: baseMessage.language,
        components: newComponents,
    };
};
