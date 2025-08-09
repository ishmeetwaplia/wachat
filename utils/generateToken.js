const jwt = require('jsonwebtoken');

const generateToken = (id, email) => {
        console.log("token",id,process.env.JWT_SECRET)

    return jwt.sign({ id, email }, process.env.JWT_SECRET, {
        expiresIn: '7d', 
        algorithm: 'HS256'
    });
};

module.exports = generateToken;
