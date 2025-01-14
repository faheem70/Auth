const ErrorHander = require("../utils/errorhander");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const User = require("../models/userModel");
const sendToken = require("../utils/jwtToken");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");
const cloudinary = require("cloudinary");
const sendRegistrationEmail = require('../utils/sendRegistrationEmail');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

passport.use(new GoogleStrategy({
  //clientID: process.env.GOOGLE_CLIENT_ID,
  //clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  //callbackURL: "http://localhost:your_port/auth/google/callback"
},
  function (accessToken, refreshToken, profile, done) {
    // Check if the user already exists in your database
    User.findOne({ googleId: profile.id }, function (err, user) {
      if (err) { return done(err); }
      if (!user) {
        // If not, create a new user
        user = new User({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value
          // You can include other user details here
        });
        user.save(function (err) {
          if (err) console.error(err);
          return done(err, user);
        });
      } else {
        // If the user exists, just return the user
        return done(err, user);
      }
    });
  }
));

// Register a User
exports.registerUser = catchAsyncErrors(async (req, res, next) => {
  try {
    let avatarData = null; // Initialize it as null, not an empty object

    if (req.body.avatar) {
      // Check if an avatar is provided in the request body
      const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
        folder: "avatars",
        width: 150,
        crop: "scale",
      });

      // Set avatarData if an avatar is uploaded
      avatarData = {
        public_id: myCloud.public_id,
        url: myCloud.secure_url,
      };
    } else if (req.body.avatar == null) {
      // Handle the case when avatar is not provided (set a default avatar)
      avatarData = {
        public_id: 'avatars/alglepsii9nvfwq5qthm',
        url: 'https://res.cloudinary.com/dkunixcth/image/upload/v1697806461/avatars/alglepsii9nvfwq5qthm.png',
      };
    }

    const { name, email, password } = req.body;

    const userData = {
      name,
      email,
      password,
      avatar: avatarData,
    };

    // Set the avatar in the userData, whether it's provided or not
    userData.avatar = avatarData;

    const user = await User.create(userData);

    const emailToken = user.generateEmailConfirmationToken();
    // console.log(emailToken);

    // Create a confirmation URL with a route in your application
    const confirmationURL = `https://arf-backend.onrender.com/confirm-email/${emailToken}`;
    user.emailConfirmationToken = emailToken;
    // Compose the email content
    await user.save();
    //  console.log(user.emailConfirmationToken);
    const subject = 'Confirm Your Registration';
    const text = `Please click this link to confirm your registration: ${confirmationURL}`;
    const html = `Please click this link to confirm your registration: <a href="${confirmationURL}">Confirm Email</a>`;

    // Use your sendEmail function to send the email
    const recipientEmail = user.email
    await sendRegistrationEmail(recipientEmail, subject, text, html);

    sendToken(user, 201, res);
  } catch (error) {
    // Handle any errors that occur during registration
    console.error(error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});


exports.confirmMail = catchAsyncErrors(async (req, res, next) => {
  try {
    const token = req.params.token;
//console.log("token", token);

    if (!token) {
      return res.status(400).json({ success: false, error: "Token is missing" });
    }

    const user = await User.findOne({ emailConfirmationToken: token });
    // console.log(user);
    if (!user) {
      return res.status(404).json({ success: false, error: "Invalid confirmation token" });
    }

    user.confirmed = true;
    user.emailConfirmationToken = undefined;
    await user.save();

    res.redirect('/login');
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// Google Signup Route
exports.googleSignup = passport.authenticate('google', { scope: ['profile', 'email'] });

// Google Signup Callback Route
exports.googleSignupCallback = passport.authenticate('google', { failureRedirect: '/login' }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  };

// Login User
exports.loginUser = catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;

  // checking if user has given password and email both

  if (!email || !password) {
    return next(new ErrorHander("Please Enter Email & Password", 400));
  }

  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return next(new ErrorHander("Invalid email or password", 401));
  }
  if (!user.confirmed) {
    return next(new ErrorHander("Please confirm your email before logging in", 401));
  }

  const isPasswordMatched = await user.comparePassword(password);

  if (!isPasswordMatched) {
    return next(new ErrorHander("Invalid email or password", 401));
  }

  sendToken(user, 200, res);
});

// Logout User
exports.logout = catchAsyncErrors(async (req, res, next) => {
  res.cookie("token", null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: "Logged Out",
  });
});

//Update User


// Forgot Password
exports.forgotPassword = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new ErrorHander("User not found", 404));
  }

  // Get ResetPassword Token
  const resetToken = user.getResetPasswordToken();

  await user.save({ validateBeforeSave: false });

  const resetPasswordUrl = `${req.protocol}://${req.get(
    "host"
  )}/password/reset/${resetToken}`;

  const message = `Your password reset token is :- \n\n ${resetPasswordUrl} \n\nIf you have not requested this email then, please ignore it.`;

  try {
    await sendEmail({
      email: user.email,
      subject: `Password Recovery`,
      message,
    });

    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} successfully`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save({ validateBeforeSave: false });

    return next(new ErrorHander(error.message, 500));
  }
});

// Reset Password
exports.resetPassword = catchAsyncErrors(async (req, res, next) => {
  // creating token hash
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(
      new ErrorHander(
        "Reset Password Token is invalid or has been expired",
        400
      )
    );
  }

  if (req.body.password !== req.body.confirmPassword) {
    return next(new ErrorHander("Password does not password", 400));
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  sendToken(user, 200, res);
});

// Get User Detail
exports.getUserDetails = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    user,
  });
});

// update User password
exports.updatePassword = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");

  const isPasswordMatched = await user.comparePassword(req.body.oldPassword);

  if (!isPasswordMatched) {
    return next(new ErrorHander("Old password is incorrect", 400));
  }

  if (req.body.newPassword !== req.body.confirmPassword) {
    return next(new ErrorHander("password does not match", 400));
  }

  user.password = req.body.newPassword;

  await user.save();

  sendToken(user, 200, res);
});

// update User Profile
exports.updateProfile = catchAsyncErrors(async (req, res, next) => {
  const newUserData = {
    name: req.body.name,
    email: req.body.email,
  };

  if (req.body.avatar !== "") {
    const user = await User.findById(req.user.id);

    const imageId = user.avatar.public_id;

    await cloudinary.v2.uploader.destroy(imageId);

    const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
      folder: "avatars",
      width: 150,
      crop: "scale",
    });

    newUserData.avatar = {
      public_id: myCloud.public_id,
      url: myCloud.secure_url,
    };
  }

  const user = await User.findByIdAndUpdate(req.user.id, newUserData, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });

  res.status(200).json({
    success: true,
  });
});

// Get all users(admin)
exports.getAllUser = catchAsyncErrors(async (req, res, next) => {
  const users = await User.find();

  res.status(200).json({
    success: true,
    users,
  });
});

// Get single user (admin)
exports.getSingleUser = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(
      new ErrorHander(`User does not exist with Id: ${req.params.id}`)
    );
  }

  res.status(200).json({
    success: true,
    user,
  });
});

// update User Role -- Admin
exports.updateUserRole = catchAsyncErrors(async (req, res, next) => {
  const newUserData = {
    name: req.body.name,
    email: req.body.email,
    role: req.body.role,
  };

  await User.findByIdAndUpdate(req.params.id, newUserData, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });

  res.status(200).json({
    success: true,
  });
});

// Delete User --Admin
exports.deleteUser = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(
      new ErrorHander(`User does not exist with Id: ${req.params.id}`, 400)
    );
  }

  const imageId = user.avatar.public_id;

  await cloudinary.v2.uploader.destroy(imageId);

  await user.remove();

  res.status(200).json({
    success: true,
    message: "User Deleted Successfully",
  });
});
