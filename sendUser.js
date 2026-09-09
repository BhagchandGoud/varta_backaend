import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import UserModel from "./models/UserModel.js";
import dotenv from "dotenv";
import dns from 'dns';

dotenv.config();

dns.setServers(['1.1.1.1', '8.8.8.8']);

const users = [
  // Users within 10km radius of 26.7507°N, 75.8103°E (Jaipur)
  {
    username: "raj_sharma",
    email: "raj.sharma@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=1",
    bio: "Software Engineer | Love coding & coffee ☕",
    isOnline: true,
    locationEnabled: true,
    // ✅ FIX: Use GeoJSON format with [longitude, latitude]
    location: {
      type: "Point",
      coordinates: [75.8080, 26.7530]
    }
  },
  {
    username: "priya_mehta",
    email: "priya.mehta@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=5",
    bio: "Digital Marketer | Travel enthusiast ✈️",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8150, 26.7480]
    }
  },
  {
    username: "amit_verma",
    email: "amit.verma@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=3",
    bio: "Data Scientist | ML enthusiast 🤖",
    isOnline: false,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8120, 26.7550]
    }
  },
  {
    username: "neha_kumar",
    email: "neha.kumar@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=10",
    bio: "UI/UX Designer | Creating beautiful experiences 🎨",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8060, 26.7520]
    }
  },
  {
    username: "vikram_singh",
    email: "vikram.singh@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=11",
    bio: "Product Manager | Building products that matter 🚀",
    isOnline: false,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8180, 26.7460]
    }
  },
  {
    username: "anjali_jain",
    email: "anjali.jain@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=20",
    bio: "Content Writer | Storyteller 📝",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8100, 26.7450]
    }
  },
  {
    username: "rahul_yadav",
    email: "rahul.yadav@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=7",
    bio: "DevOps Engineer | Cloud native ☁️",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8050, 26.7580]
    }
  },
  {
    username: "sneha_patel",
    email: "sneha.patel@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=25",
    bio: "HR Professional | People person 🤝",
    isOnline: false,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8200, 26.7500]
    }
  },
  {
    username: "arjun_reddy",
    email: "arjun.reddy@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=12",
    bio: "Full Stack Developer | MERN stack ⚛️",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8130, 26.7600]
    }
  },
  {
    username: "kavya_sharma",
    email: "kavya.sharma@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=30",
    bio: "Graphic Designer | Visual artist 🎨",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8070, 26.7470]
    }
  },
  {
    username: "deepak_gupta",
    email: "deepak.gupta@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=33",
    bio: "Mobile Developer | React Native 📱",
    isOnline: false,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8160, 26.7550]
    }
  },
  {
    username: "ritika_aggarwal",
    email: "ritika.aggarwal@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=35",
    bio: "Marketing Specialist | Brand builder 📈",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8090, 26.7510]
    }
  },
  {
    username: "manish_joshi",
    email: "manish.joshi@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=40",
    bio: "System Administrator | Network security 🔒",
    isOnline: false,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8110, 26.7570]
    }
  },
  {
    username: "pooja_kapoor",
    email: "pooja.kapoor@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=45",
    bio: "Business Analyst | Data-driven decisions 📊",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8140, 26.7490]
    }
  },
  {
    username: "suresh_kumar",
    email: "suresh.kumar@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=50",
    bio: "Database Administrator | SQL & NoSQL 🗄️",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8170, 26.7520]
    }
  },
  {
    username: "meera_nair",
    email: "meera.nair@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=55",
    bio: "Project Manager | Agile enthusiast 📋",
    isOnline: false,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8080, 26.7560]
    }
  },
  {
    username: "vivek_agarwal",
    email: "vivek.agarwal@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=60",
    bio: "Frontend Developer | React & Vue ⚡",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8155, 26.7540]
    }
  },
  {
    username: "sonia_rao",
    email: "sonia.rao@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=65",
    bio: "Content Strategist | Creative writing ✍️",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8065, 26.7535]
    }
  },
  {
    username: "mohit_singhal",
    email: "mohit.singhal@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=70",
    bio: "Backend Developer | Node.js & Python 🐍",
    isOnline: false,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8190, 26.7480]
    }
  },
  {
    username: "divya_choudhary",
    email: "divya.choudhary@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=75",
    bio: "Social Media Manager | Digital marketing 📱",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8125, 26.7505]
    }
  },
  {
    username: "ankit_bansal",
    email: "ankit.bansal@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=80",
    bio: "Cloud Architect | AWS & Azure ☁️",
    isOnline: false,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8040, 26.7590]
    }
  },
  {
    username: "shreya_das",
    email: "shreya.das@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=85",
    bio: "Tech Writer | Documentation 📚",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8100, 26.7580]
    }
  },
  {
    username: "gaurav_malhotra",
    email: "gaurav.malhotra@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=90",
    bio: "ML Engineer | AI & Deep Learning 🤖",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8165, 26.7470]
    }
  },
  {
    username: "tanvi_shah",
    email: "tanvi.shah@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=95",
    bio: "Interior Designer | Creating spaces 🏠",
    isOnline: false,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8075, 26.7490]
    }
  },
  {
    username: "rohit_mehra",
    email: "rohit.mehra@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=100",
    bio: "Game Developer | Unity & C# 🎮",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8185, 26.7510]
    }
  },
  {
    username: "sapna_tiwari",
    email: "sapna.tiwari@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=105",
    bio: "Corporate Lawyer | Legal advisor ⚖️",
    isOnline: false,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8055, 26.7540]
    }
  },
  {
    username: "harsh_jain",
    email: "harsh.jain@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=110",
    bio: "Blockchain Developer | Web3 enthusiast ⛓️",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8115, 26.7525]
    }
  },
  {
    username: "kirti_goyal",
    email: "kirti.goyal@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=115",
    bio: "Event Planner | Creating memories 🎉",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8145, 26.7560]
    }
  },
  {
    username: "dev_kumar",
    email: "dev.kumar@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=120",
    bio: "Security Engineer | Cyber security 🔐",
    isOnline: false,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8095, 26.7555]
    }
  },
  {
    username: "megha_arora",
    email: "megha.arora@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=125",
    bio: "Nutritionist | Health & wellness 🥗",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8175, 26.7495]
    }
  },
  {
    username: "rajat_saxena",
    email: "rajat.saxena@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=130",
    bio: "Data Analyst | SQL & Tableau 📊",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8085, 26.7500]
    }
  },
  {
    username: "nidhi_verma",
    email: "nidhi.verma@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=135",
    bio: "Digital Artist | Illustrator 🎨",
    isOnline: false,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8135, 26.7475]
    }
  },
  {
    username: "vishal_garg",
    email: "vishal.garg@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=140",
    bio: "Product Designer | UX/UI design 🎯",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8105, 26.7590]
    }
  },
  {
    username: "anita_pillai",
    email: "anita.pillai@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=145",
    bio: "Research Scientist | Biochemistry 🔬",
    isOnline: false,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8060, 26.7505]
    }
  },
  {
    username: "karan_joshi",
    email: "karan.joshi@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=150",
    bio: "E-commerce Specialist | Online retail 🛒",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8150, 26.7580]
    }
  },
  {
    username: "ruchika_bhatia",
    email: "ruchika.bhatia@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=155",
    bio: "Psychologist | Mental health advocate 🧠",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8120, 26.7515]
    }
  },
  {
    username: "dinesh_rana",
    email: "dinesh.rana@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=160",
    bio: "Civil Engineer | Infrastructure building 🏗️",
    isOnline: false,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8070, 26.7575]
    }
  },
  {
    username: "mahima_singh",
    email: "mahima.singh@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=165",
    bio: "Fashion Designer | Style & creativity 👗",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8180, 26.7475]
    }
  },
  {
    username: "akash_mishra",
    email: "akash.mishra@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=170",
    bio: "IoT Engineer | Smart devices enthusiast 📡",
    isOnline: true,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8055, 26.7520]
    }
  },
  {
    username: "swati_saxena",
    email: "swati.saxena@gmail.com",
    password: "password123",
    profileImage: "https://i.pravatar.cc/150?img=175",
    bio: "SEO Specialist | Organic growth 📈",
    isOnline: false,
    locationEnabled: true,
    location: {
      type: "Point",
      coordinates: [75.8160, 26.7490]
    }
  }
];

async function seedUsers() {
  try {
    await mongoose.connect(process.env.DB_CONNECTION);

    // 🔥 First, drop the existing collection to avoid index issues
    try {
      await UserModel.collection.drop();
    } catch (error) {
    }

    // Hash passwords
    const hashedUsers = await Promise.all(
      users.map(async (user) => {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(user.password, salt);
        return {
          ...user,
          password: hashedPassword,
          lastSeen: user.isOnline ? new Date() : new Date(Date.now() - 3600000),
          lastLocationUpdate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
      })
    );

    // Insert users
    const result = await UserModel.insertMany(hashedUsers);
    
    // Show sample users
    result.slice(0, 5).forEach((user, index) => {
    });
    
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

seedUsers();